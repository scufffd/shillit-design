/**
 * Fee collection for Meteora DBC pools.
 * Claim partner (launchpad) or build unsigned creator claim txs.
 * Pool can be identified by pool address or token mint (derive via getPoolByBaseMint).
 */

import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { loadLaunchpadKeypair } from "./launchpad-keypair";

export interface ClaimableFees {
  partnerTradingFees: number;
  creatorTradingFees: number;
  partnerLpFees: number;
  creatorLpFees: number;
  poolMigrated: boolean;
  poolAddress: string;
}

function getConnection(): Connection {
  const rpc = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
  if (!rpc) throw new Error("RPC_URL or NEXT_PUBLIC_RPC_URL required");
  return new Connection(rpc, "confirmed");
}

/** Pool account fields we need (from SDK getPool / getPoolByBaseMint). */
interface PoolAccountLike {
  config: PublicKey;
  migrated: boolean;
  partnerLpAmount?: { toNumber: () => number };
}

/**
 * Resolve pool address and pool account from pool address or token mint.
 */
export async function resolvePoolAddress(
  connection: Connection,
  poolOrMint: string
): Promise<{ poolAddress: string; poolPubkey: PublicKey; poolAccount: PoolAccountLike } | null> {
  const client = new DynamicBondingCurveClient(connection, "confirmed");
  const pubkey = new PublicKey(poolOrMint);
  try {
    const pool = await client.state.getPool(pubkey);
    if (pool)
      return {
        poolAddress: pubkey.toBase58(),
        poolPubkey: pubkey,
        poolAccount: pool as unknown as PoolAccountLike,
      };
  } catch {
    // try as base mint
  }
  try {
    const result = await client.state.getPoolByBaseMint(pubkey);
    if (result) {
      const item = result as unknown as { publicKey: PublicKey; account: PoolAccountLike };
      const poolAddress = item.publicKey.toBase58();
      const poolAccount = item.account ?? (item as unknown as PoolAccountLike);
      return {
        poolAddress,
        poolPubkey: item.publicKey,
        poolAccount,
      };
    }
  } catch {
    // not found
  }
  return null;
}

/**
 * Get claimable fees for a pool (by pool address or token mint).
 */
export async function getClaimableFees(poolOrMint: string): Promise<ClaimableFees | null> {
  const connection = getConnection();
  const resolved = await resolvePoolAddress(connection, poolOrMint);
  if (!resolved) return null;
  const { poolAddress, poolPubkey, poolAccount } = resolved;
  const client = new DynamicBondingCurveClient(connection, "confirmed");
  const feeMetrics = await client.state.getPoolFeeMetrics(poolPubkey);
  const partnerQuote = feeMetrics.current.partnerQuoteFee;
  const creatorQuote = feeMetrics.current.creatorQuoteFee;
  const partnerLp = poolAccount.migrated && poolAccount.partnerLpAmount ? poolAccount.partnerLpAmount.toNumber() / 1e9 : 0;
  return {
    poolAddress,
    partnerTradingFees: partnerQuote.toNumber() / 1e9,
    creatorTradingFees: (creatorQuote?.toNumber() ?? 0) / 1e9,
    partnerLpFees: partnerLp,
    creatorLpFees: 0,
    poolMigrated: poolAccount.migrated,
  };
}

/**
 * Build unsigned creator trading-fee claim tx (for frontend to sign).
 */
export async function createCreatorTradingFeeClaimTransaction(
  poolOrMint: string,
  creatorWallet: string
): Promise<{ transaction: string; claimableAmount: number } | { error: string }> {
  const connection = getConnection();
  const resolved = await resolvePoolAddress(connection, poolOrMint);
  if (!resolved) return { error: "Pool not found" };
  const fees = await getClaimableFees(resolved.poolAddress);
  if (!fees || fees.creatorTradingFees <= 0) return { error: "No creator trading fees to claim" };
  const client = new DynamicBondingCurveClient(connection, "confirmed");
  const claimTx = await client.creator.claimCreatorTradingFee({
    pool: resolved.poolPubkey,
    creator: new PublicKey(creatorWallet),
    maxBaseAmount: new BN(0),
    maxQuoteAmount: new BN(Math.floor(fees.creatorTradingFees * 1e9)),
    payer: new PublicKey(creatorWallet),
  });
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  claimTx.recentBlockhash = blockhash;
  claimTx.feePayer = new PublicKey(creatorWallet);
  const serialized = claimTx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
  return { transaction: serialized, claimableAmount: fees.creatorTradingFees };
}

/**
 * Build unsigned creator LP claim tx (post-migration only). Uses migration.claimDammV1LpToken.
 */
export async function createCreatorLpClaimTransaction(
  poolOrMint: string,
  creatorWallet: string
): Promise<{ transaction: string; claimableAmount: number } | { error: string }> {
  const connection = getConnection();
  const resolved = await resolvePoolAddress(connection, poolOrMint);
  if (!resolved) return { error: "Pool not found" };
  const fees = await getClaimableFees(resolved.poolAddress);
  if (!fees || !fees.poolMigrated || fees.creatorLpFees <= 0) return { error: "No creator LP fees to claim or pool not migrated" };
  const client = new DynamicBondingCurveClient(connection, "confirmed");
  const claimTx = await client.migration.claimDammV1LpToken({
    payer: new PublicKey(creatorWallet),
    virtualPool: resolved.poolPubkey,
    dammConfig: resolved.poolAccount.config,
    isPartner: false,
  });
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  claimTx.recentBlockhash = blockhash;
  claimTx.feePayer = new PublicKey(creatorWallet);
  const serialized = claimTx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
  return { transaction: serialized, claimableAmount: fees.creatorLpFees };
}

/**
 * Claim partner trading fees (server-signed). Requires LAUNCHPAD_PRIVATE_KEY.
 */
export async function claimPartnerTradingFees(poolOrMint: string): Promise<{
  success: boolean;
  claimedAmount?: number;
  signature?: string;
  error?: string;
}> {
  const connection = getConnection();
  const keypair = loadLaunchpadKeypair();
  const resolved = await resolvePoolAddress(connection, poolOrMint);
  if (!resolved) return { success: false, error: "Pool not found" };
  const fees = await getClaimableFees(resolved.poolAddress);
  if (!fees || fees.partnerTradingFees <= 0) return { success: false, error: "No partner trading fees to claim" };
  const client = new DynamicBondingCurveClient(connection, "confirmed");
  const claimTx = await client.partner.claimPartnerTradingFee({
    pool: resolved.poolPubkey,
    feeClaimer: keypair.publicKey,
    maxBaseAmount: new BN(0),
    maxQuoteAmount: new BN(Math.floor(fees.partnerTradingFees * 1e9)),
    payer: keypair.publicKey,
  });
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  claimTx.recentBlockhash = blockhash;
  claimTx.feePayer = keypair.publicKey;
  claimTx.sign(keypair);
  try {
    const sig = await connection.sendRawTransaction(claimTx.serialize(), { skipPreflight: false, maxRetries: 3 });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
    return { success: true, claimedAmount: fees.partnerTradingFees, signature: sig };
  } catch (e: unknown) {
    const err = e as { message?: string; transactionLogs?: string[] };
    const logs = err.transactionLogs ?? [];
    const logStr = logs.join(" ");
    if (
      logStr.includes("Unauthorized") ||
      logStr.includes("Not permit to do this action") ||
      logStr.includes("0x17a5") ||
      (err.message && err.message.includes("0x17a5"))
    ) {
      return {
        success: false,
        error:
          "Partner claim unauthorized: the keypair in DBC_PAYER_KEYPAIR_PATH (or LAUNCHPAD_PRIVATE_KEY) must be the same wallet registered as the fee claimer / partner when your Meteora DBC pool config was created. Check that config/keypair.json matches the partner address on your pool config.",
      };
    }
    throw e;
  }
}

/**
 * Claim partner LP fees (post-migration only). Uses migration.claimDammV1LpToken. Requires LAUNCHPAD_PRIVATE_KEY.
 */
export async function claimPartnerLpFees(poolOrMint: string): Promise<{
  success: boolean;
  claimedAmount?: number;
  signature?: string;
  error?: string;
}> {
  const connection = getConnection();
  const keypair = loadLaunchpadKeypair();
  const resolved = await resolvePoolAddress(connection, poolOrMint);
  if (!resolved) return { success: false, error: "Pool not found" };
  const fees = await getClaimableFees(resolved.poolAddress);
  if (!fees || !fees.poolMigrated || fees.partnerLpFees <= 0)
    return { success: false, error: "No partner LP fees to claim or pool not migrated" };
  const client = new DynamicBondingCurveClient(connection, "confirmed");
  const claimTx = await client.migration.claimDammV1LpToken({
    payer: keypair.publicKey,
    virtualPool: resolved.poolPubkey,
    dammConfig: resolved.poolAccount.config,
    isPartner: true,
  });
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  claimTx.recentBlockhash = blockhash;
  claimTx.feePayer = keypair.publicKey;
  claimTx.sign(keypair);
  const sig = await connection.sendRawTransaction(claimTx.serialize(), { skipPreflight: false, maxRetries: 3 });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
  return { success: true, claimedAmount: fees.partnerLpFees, signature: sig };
}
