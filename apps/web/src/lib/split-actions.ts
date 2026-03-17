/**
 * Split actions: pay creator cut (SOL), buyback and burn (swap SOL → token, then burn delta).
 * Buyback uses Meteora DBC native swap when the token has a DBC pool (no Jupiter); falls back to Jupiter for migrated pools.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createBurnCheckedInstruction,
  getAccount,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { resolvePoolAddress } from "./fee-collection-service";

const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap";
const SOL_MINT = "So11111111111111111111111111111111111111112";

/**
 * Buy token with SOL via Meteora DBC pool (native swap). Use when token has a non-migrated DBC pool.
 * Returns signature and bought base amount (raw) on success.
 */
async function buybackViaDbc(params: {
  connection: Connection;
  payerKeypair: Keypair;
  tokenMint: string;
  lamports: number;
  poolAddress: string;
}): Promise<{ success: boolean; signature?: string; boughtAmount?: number; error?: string }> {
  const { connection, payerKeypair, tokenMint, lamports, poolAddress } = params;
  try {
    const client = new DynamicBondingCurveClient(connection, "confirmed");
    const poolPubkey = new PublicKey(poolAddress);
    const swapTx = await client.pool.swap({
      owner: payerKeypair.publicKey,
      pool: poolPubkey,
      amountIn: new BN(lamports),
      minimumAmountOut: new BN(0),
      swapBaseForQuote: false, // quote (SOL) → base (token) = buy
      referralTokenAccount: null,
    });
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    swapTx.recentBlockhash = blockhash;
    swapTx.feePayer = payerKeypair.publicKey;
    swapTx.sign(payerKeypair);
    const sig = await connection.sendRawTransaction(swapTx.serialize(), { skipPreflight: false, maxRetries: 3 });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
    return { success: true, signature: sig };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `DBC swap failed: ${msg}` };
  }
}

/**
 * Send SOL to the creator wallet.
 */
export async function payCreatorCut(params: {
  connection: Connection;
  payerKeypair: Keypair;
  creatorWallet: string;
  lamports: number;
}): Promise<{ success: boolean; signature?: string; error?: string }> {
  const { connection, payerKeypair, creatorWallet, lamports } = params;
  if (lamports <= 0) return { success: true };
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payerKeypair.publicKey,
      toPubkey: new PublicKey(creatorWallet),
      lamports,
    })
  );
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = payerKeypair.publicKey;
  tx.sign(payerKeypair);
  try {
    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
    return { success: true, signature: sig };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Transfer failed" };
  }
}

/**
 * Buy token with SOL (Meteora DBC first, then Jupiter fallback), then burn only the newly bought amount (delta).
 * Gets pre-buy balance, swaps SOL→token, then burns (postBalance - preBalance).
 */
export async function buybackAndBurn(params: {
  connection: Connection;
  payerKeypair: Keypair;
  tokenMint: string;
  lamports: number;
  slippageBps?: number;
}): Promise<{ success: boolean; boughtAmount?: number; burnedAmount?: number; signature?: string; error?: string }> {
  const { connection, payerKeypair, tokenMint, lamports, slippageBps = 1000 } = params;
  if (lamports <= 0) return { success: false, error: "lamports must be positive" };
  const mintPubkey = new PublicKey(tokenMint);
  const payerAta = getAssociatedTokenAddressSync(mintPubkey, payerKeypair.publicKey);
  let preBalance = BigInt(0);
  try {
    const acc = await getAccount(connection, payerAta);
    preBalance = BigInt(acc.amount.toString());
  } catch {
    // ATA may not exist yet
  }

  // Prefer Meteora DBC native swap when the token has a non-migrated DBC pool (no external API).
  const resolved = await resolvePoolAddress(connection, tokenMint);
  let swapSuccess = false;
  if (resolved && !resolved.poolAccount.migrated) {
    const dbcResult = await buybackViaDbc({
      connection,
      payerKeypair,
      tokenMint,
      lamports,
      poolAddress: resolved.poolAddress,
    });
    swapSuccess = dbcResult.success;
    if (!swapSuccess) {
      // Fall through to Jupiter fallback (e.g. "Virtual pool is completed" after migration)
    }
  }

  if (!swapSuccess) {
    // Fallback: Jupiter quote + swap (requires quote-api.jup.ag; use when DBC pool migrated or unavailable)
    const quoteUrl = new URL(JUPITER_QUOTE_API);
    quoteUrl.searchParams.set("inputMint", SOL_MINT);
    quoteUrl.searchParams.set("outputMint", tokenMint);
    quoteUrl.searchParams.set("amount", String(lamports));
    quoteUrl.searchParams.set("slippageBps", String(slippageBps));
    let quoteRes: Response;
    try {
      quoteRes = await fetch(quoteUrl.toString());
    } catch (e) {
      return { success: false, error: `Jupiter unreachable: ${e instanceof Error ? e.message : "fetch failed"}. Use a token with a DBC pool for buyback.` };
    }
    if (!quoteRes.ok) {
      const text = await quoteRes.text();
      return { success: false, error: `Jupiter quote failed: ${text.slice(0, 200)}` };
    }
    const quote = await quoteRes.json();
    const swapRes = await fetch(JUPITER_SWAP_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: payerKeypair.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
      }),
    });
    if (!swapRes.ok) {
      const text = await swapRes.text();
      return { success: false, error: `Jupiter swap failed: ${text.slice(0, 200)}` };
    }
    const swapData = await swapRes.json();
    const swapTxBuf = Buffer.from(swapData.swapTransaction, "base64");
    const swapTx = VersionedTransaction.deserialize(swapTxBuf);
    swapTx.sign([payerKeypair]);
    try {
      const sig = await connection.sendRawTransaction(Buffer.from(swapTx.serialize()), { skipPreflight: false, maxRetries: 3 });
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Swap failed" };
    }
  }

  let postBalance = BigInt(0);
  try {
    const acc = await getAccount(connection, payerAta);
    postBalance = BigInt(acc.amount.toString());
  } catch {
    return { success: true, error: "Swap sent but could not read post-balance for burn" };
  }
  const delta = postBalance - preBalance;
  if (delta <= BigInt(0)) return { success: true, boughtAmount: 0, burnedAmount: 0 };

  const mintInfo = await getMint(connection, mintPubkey);
  const decimals = mintInfo.decimals;
  const burnTx = new Transaction();
  burnTx.add(
    createBurnCheckedInstruction(
      payerAta,
      mintPubkey,
      payerKeypair.publicKey,
      delta,
      decimals,
      [],
      TOKEN_PROGRAM_ID
    )
  );
  burnTx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  burnTx.feePayer = payerKeypair.publicKey;
  burnTx.sign(payerKeypair);
  try {
    const burnSig = await connection.sendRawTransaction(burnTx.serialize(), { skipPreflight: false, maxRetries: 3 });
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction({ signature: burnSig, blockhash, lastValidBlockHeight });
    return {
      success: true,
      boughtAmount: Number(delta),
      burnedAmount: Number(delta),
      signature: burnSig,
    };
  } catch (e) {
    return {
      success: true,
      boughtAmount: Number(delta),
      burnedAmount: 0,
      error: "Burn failed: " + (e instanceof Error ? e.message : "unknown"),
    };
  }
}

/**
 * Buy token with SOL (buyback only; do not burn). Uses same DBC/Jupiter flow as buybackAndBurn.
 * Tokens remain in the payer ATA (e.g. for LP or treasury).
 */
export async function buybackOnly(params: {
  connection: Connection;
  payerKeypair: Keypair;
  tokenMint: string;
  lamports: number;
  slippageBps?: number;
}): Promise<{ success: boolean; boughtAmount?: number; signature?: string; error?: string }> {
  const { connection, payerKeypair, tokenMint, lamports, slippageBps = 1000 } = params;
  if (lamports <= 0) return { success: false, error: "lamports must be positive" };
  const mintPubkey = new PublicKey(tokenMint);
  const payerAta = getAssociatedTokenAddressSync(mintPubkey, payerKeypair.publicKey);
  let preBalance = BigInt(0);
  try {
    const acc = await getAccount(connection, payerAta);
    preBalance = BigInt(acc.amount.toString());
  } catch {
    // ATA may not exist yet
  }

  const resolved = await resolvePoolAddress(connection, tokenMint);
  let swapSuccess = false;
  if (resolved && !resolved.poolAccount.migrated) {
    const dbcResult = await buybackViaDbc({
      connection,
      payerKeypair,
      tokenMint,
      lamports,
      poolAddress: resolved.poolAddress,
    });
    swapSuccess = dbcResult.success;
  }

  if (!swapSuccess) {
    const quoteUrl = new URL(JUPITER_QUOTE_API);
    quoteUrl.searchParams.set("inputMint", SOL_MINT);
    quoteUrl.searchParams.set("outputMint", tokenMint);
    quoteUrl.searchParams.set("amount", String(lamports));
    quoteUrl.searchParams.set("slippageBps", String(slippageBps));
    try {
      const quoteRes = await fetch(quoteUrl.toString());
      if (!quoteRes.ok) return { success: false, error: `Jupiter quote failed: ${await quoteRes.text()}` };
      const quote = await quoteRes.json();
      const swapRes = await fetch(JUPITER_SWAP_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: payerKeypair.publicKey.toBase58(),
          wrapAndUnwrapSol: true,
        }),
      });
      if (!swapRes.ok) return { success: false, error: `Jupiter swap failed: ${await swapRes.text()}` };
      const swapData = await swapRes.json();
      const swapTxBuf = Buffer.from(swapData.swapTransaction, "base64");
      const swapTx = VersionedTransaction.deserialize(swapTxBuf);
      swapTx.sign([payerKeypair]);
      const sig = await connection.sendRawTransaction(Buffer.from(swapTx.serialize()), { skipPreflight: false, maxRetries: 3 });
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Swap failed" };
    }
  }

  let postBalance = BigInt(0);
  try {
    const acc = await getAccount(connection, payerAta);
    postBalance = BigInt(acc.amount.toString());
  } catch {
    return { success: true, boughtAmount: 0 };
  }
  const delta = postBalance - preBalance;
  return { success: true, boughtAmount: delta > BigInt(0) ? Number(delta) : 0 };
}

/**
 * Build an unsigned Jupiter swap transaction to sell token for SOL (dev sell).
 * Returns base64-encoded VersionedTransaction for the client to sign and send.
 */
export async function buildDevSellTransaction(params: {
  connection: Connection;
  tokenMint: string;
  sellerWallet: string;
  percent: number;
  slippageBps?: number;
}): Promise<{ swapTransactionBase64: string; amountRaw: string; error?: string }> {
  try {
    const { connection, tokenMint, sellerWallet, percent, slippageBps = 1500 } = params;
    const mintPubkey = new PublicKey(tokenMint);
    const sellerPubkey = new PublicKey(sellerWallet);
    const ata = getAssociatedTokenAddressSync(mintPubkey, sellerPubkey);
    let balanceRaw = BigInt(0);
    try {
      const acc = await getAccount(connection, ata);
      balanceRaw = BigInt(acc.amount.toString());
    } catch {
      return { swapTransactionBase64: "", amountRaw: "0", error: "Token account not found or zero balance" };
    }
    if (balanceRaw <= BigInt(0)) {
      return { swapTransactionBase64: "", amountRaw: "0", error: "Zero token balance" };
    }
    const pct = Math.min(100, Math.max(1, percent));
    const amountRaw = (balanceRaw * BigInt(pct)) / BigInt(100);
    if (amountRaw <= BigInt(0)) {
      return { swapTransactionBase64: "", amountRaw: "0", error: "Sell amount is zero" };
    }
    const quoteUrl = new URL(JUPITER_QUOTE_API);
    quoteUrl.searchParams.set("inputMint", tokenMint);
    quoteUrl.searchParams.set("outputMint", SOL_MINT);
    quoteUrl.searchParams.set("amount", amountRaw.toString());
    quoteUrl.searchParams.set("slippageBps", String(slippageBps));
    let quoteRes: Response;
    try {
      quoteRes = await fetch(quoteUrl.toString());
    } catch (e) {
      return { swapTransactionBase64: "", amountRaw: amountRaw.toString(), error: `Network error: ${e instanceof Error ? e.message : "fetch failed"}` };
    }
    if (!quoteRes.ok) {
      const text = await quoteRes.text();
      return { swapTransactionBase64: "", amountRaw: amountRaw.toString(), error: `Jupiter quote failed (${quoteRes.status}): ${text.slice(0, 200)}` };
    }
    let quote: unknown;
    try {
      quote = await quoteRes.json();
    } catch {
      return { swapTransactionBase64: "", amountRaw: amountRaw.toString(), error: "Jupiter quote returned invalid JSON" };
    }
    if (quote && typeof quote === "object" && "error" in quote && typeof (quote as { error: string }).error === "string") {
      return { swapTransactionBase64: "", amountRaw: amountRaw.toString(), error: `Jupiter: ${(quote as { error: string }).error}` };
    }
    let swapRes: Response;
    try {
      swapRes = await fetch(JUPITER_SWAP_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: sellerWallet,
          wrapAndUnwrapSol: true,
        }),
      });
    } catch (e) {
      return { swapTransactionBase64: "", amountRaw: amountRaw.toString(), error: `Network error: ${e instanceof Error ? e.message : "swap fetch failed"}` };
    }
    if (!swapRes.ok) {
      const text = await swapRes.text();
      return { swapTransactionBase64: "", amountRaw: amountRaw.toString(), error: `Jupiter swap failed (${swapRes.status}): ${text.slice(0, 200)}` };
    }
    let swapData: { swapTransaction?: string; error?: string };
    try {
      swapData = await swapRes.json();
    } catch {
      return { swapTransactionBase64: "", amountRaw: amountRaw.toString(), error: "Jupiter swap returned invalid JSON" };
    }
    if (swapData && typeof swapData === "object" && typeof swapData.error === "string") {
      return { swapTransactionBase64: "", amountRaw: amountRaw.toString(), error: `Jupiter: ${swapData.error}` };
    }
    const swapTransactionBase64 = swapData?.swapTransaction;
    if (!swapTransactionBase64 || typeof swapTransactionBase64 !== "string") {
      return { swapTransactionBase64: "", amountRaw: amountRaw.toString(), error: "No swap transaction in response (token may have no liquidity on Jupiter)" };
    }
    return { swapTransactionBase64, amountRaw: amountRaw.toString() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error building sell tx";
    return { swapTransactionBase64: "", amountRaw: "0", error: msg };
  }
}
