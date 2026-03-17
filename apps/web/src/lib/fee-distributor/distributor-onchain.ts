/**
 * After publishing an epoch to disk, fund the vault and post the Merkle root on-chain.
 * Call this from the rewards runner when using the distributor instead of push payouts.
 */

import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { publishEpoch, type Allocation } from "./publish";
import { buildFundVaultIx, buildInitMintIx, buildUpsertEpochIx, deriveDistributorPdas } from "./anchor-ix";

export interface EnsureDistributorMintParams {
  connection: Connection;
  authorityKeypair: Keypair;
  mint: string;
}

export interface EnsureDistributorMintResult {
  success: boolean;
  alreadyInitialized?: boolean;
  initTxSig?: string;
  error?: string;
}

/**
 * Idempotently ensure init_mint was run for a mint.
 * Checks for the config PDA; if missing, sends init_mint (payer/authority = authorityKeypair).
 */
export async function ensureDistributorMintInitialized(
  params: EnsureDistributorMintParams
): Promise<EnsureDistributorMintResult> {
  const programIdStr = process.env.DISTRIBUTOR_PROGRAM_ID?.trim();
  if (!programIdStr) return { success: false, error: "DISTRIBUTOR_PROGRAM_ID not set" };
  const programId = new PublicKey(programIdStr);
  const mintPk = new PublicKey(params.mint);
  const { config } = deriveDistributorPdas({ programId, mint: mintPk });
  const existing = await params.connection.getAccountInfo(config, "confirmed");
  if (existing) return { success: true, alreadyInitialized: true };

  const ix = buildInitMintIx({
    programId,
    mint: mintPk,
    payer: params.authorityKeypair.publicKey,
    authority: params.authorityKeypair.publicKey,
  });
  const tx = new Transaction().add(ix);
  tx.feePayer = params.authorityKeypair.publicKey;
  tx.recentBlockhash = (await params.connection.getLatestBlockhash("confirmed")).blockhash;
  try {
    const sig = await params.connection.sendTransaction(tx, [params.authorityKeypair], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    await params.connection.confirmTransaction(sig, "confirmed");
    return { success: true, alreadyInitialized: false, initTxSig: sig };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface RunDistributorEpochParams {
  connection: Connection;
  authorityKeypair: Keypair;
  mint: string;
  allocations: Allocation[];
  epochId?: number;
}

export interface RunDistributorEpochResult {
  success: boolean;
  epochId?: number;
  merkleRoot?: string;
  totalLamports?: number;
  recipientCount?: number;
  fundTxSig?: string;
  upsertTxSig?: string;
  error?: string;
}

/**
 * Publish epoch (Merkle + JSON), then send fund_vault and upsert_epoch.
 * Requires DISTRIBUTOR_PROGRAM_ID and that the mint's config is already inited on-chain.
 */
export async function runDistributorEpoch(
  params: RunDistributorEpochParams
): Promise<RunDistributorEpochResult> {
  const programIdStr = process.env.DISTRIBUTOR_PROGRAM_ID?.trim();
  if (!programIdStr) {
    return { success: false, error: "DISTRIBUTOR_PROGRAM_ID not set" };
  }
  const programId = new PublicKey(programIdStr);
  const mintPk = new PublicKey(params.mint);

  const published = publishEpoch({
    mint: params.mint,
    allocations: params.allocations,
    epochId: params.epochId,
  });
  if (published.recipientCount === 0) {
    return { success: true, ...published };
  }

  const fundIx = buildFundVaultIx({
    programId,
    mint: mintPk,
    funder: params.authorityKeypair.publicKey,
    lamports: BigInt(published.totalLamports),
  });
  const upsertIx = buildUpsertEpochIx({
    programId,
    mint: mintPk,
    authority: params.authorityKeypair.publicKey,
    payer: params.authorityKeypair.publicKey,
    epochId: published.epochId,
    merkleRoot: Buffer.from(published.merkleRoot, "hex"),
    totalLamports: published.totalLamports,
  });

  const tx = new Transaction().add(fundIx, upsertIx);
  tx.feePayer = params.authorityKeypair.publicKey;
  tx.recentBlockhash = (await params.connection.getLatestBlockhash("confirmed")).blockhash;

  try {
    const sig = await params.connection.sendTransaction(tx, [params.authorityKeypair], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    await params.connection.confirmTransaction(sig, "confirmed");
    return {
      success: true,
      epochId: published.epochId,
      merkleRoot: published.merkleRoot,
      totalLamports: published.totalLamports,
      recipientCount: published.recipientCount,
      fundTxSig: sig,
      upsertTxSig: sig,
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      epochId: published.epochId,
      merkleRoot: published.merkleRoot,
      totalLamports: published.totalLamports,
      recipientCount: published.recipientCount,
      error: err,
    };
  }
}
