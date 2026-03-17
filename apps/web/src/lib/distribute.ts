/**
 * Proportional reward calculation and SOL distribution to token holders.
 * Refi-live pattern: rewardLamports = (distributableLamports * holder.balance) / totalSupply; remainder to largest.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { ComputeBudgetProgram } from "@solana/web3.js";
import type { HolderInfo } from "./holders";

export interface HolderReward {
  address: string;
  balance: bigint;
  rewardLamports: number;
  sharePercent: number;
}

const MAX_TRANSFERS_PER_TX = 10;
const DEFAULT_PRIORITY_FEE_LAMPORTS = 10_000;

/**
 * Calculate per-holder SOL rewards (integer division). Remainder goes to largest-share holder.
 */
export function calculateRewards(
  holders: HolderInfo[],
  totalSupply: bigint,
  distributableLamports: number
): HolderReward[] {
  if (totalSupply === BigInt(0) || distributableLamports <= 0) return [];
  const qualified: HolderReward[] = [];
  let allocated = 0;
  for (const h of holders) {
    const rewardLamports = Number((BigInt(distributableLamports) * h.balance) / totalSupply);
    if (rewardLamports < 1) continue;
    const sharePercent = (Number(h.balance) / Number(totalSupply)) * 100;
    qualified.push({
      address: h.address,
      balance: h.balance,
      rewardLamports,
      sharePercent,
    });
    allocated += rewardLamports;
  }
  if (qualified.length === 0) return [];
  const remainder = distributableLamports - allocated;
  if (remainder > 0) {
    const largest = qualified.reduce((m, h) => (h.rewardLamports > m.rewardLamports ? h : m));
    largest.rewardLamports += remainder;
  }
  return qualified;
}

/**
 * Send SOL to holders in batches. Uses ComputeBudgetProgram for priority fee.
 */
export async function distributeRewardsSol(params: {
  connection: Connection;
  payerKeypair: Keypair;
  rewards: HolderReward[];
  priorityFeeLamports?: number;
}): Promise<{ signatures: string[]; error?: string }> {
  const { connection, payerKeypair, rewards, priorityFeeLamports = DEFAULT_PRIORITY_FEE_LAMPORTS } = params;
  const signatures: string[] = [];
  for (let i = 0; i < rewards.length; i += MAX_TRANSFERS_PER_TX) {
    const batch = rewards.slice(i, i + MAX_TRANSFERS_PER_TX);
    const tx = new Transaction();
    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: Math.ceil(priorityFeeLamports / 1000),
      })
    );
    for (const { address, rewardLamports } of batch) {
      if (rewardLamports < 1) continue;
      tx.add(
        SystemProgram.transfer({
          fromPubkey: payerKeypair.publicKey,
          toPubkey: new PublicKey(address),
          lamports: rewardLamports,
        })
      );
    }
    if (tx.instructions.length <= 1) continue;
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = payerKeypair.publicKey;
    tx.sign(payerKeypair);
    try {
      const sig = await sendAndConfirmTransaction(
        connection,
        tx,
        [payerKeypair],
        {
          skipPreflight: false,
          maxRetries: 3,
          commitment: "confirmed",
          preflightCommitment: "confirmed",
        }
      );
      signatures.push(sig);
    } catch (e) {
      return {
        signatures,
        error: e instanceof Error ? e.message : "Batch send failed",
      };
    }
  }
  return { signatures };
}
