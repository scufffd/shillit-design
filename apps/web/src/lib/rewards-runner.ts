/**
 * One cycle: claim partner fees for a token, then split (creator / holders / buyback).
 * Uses LAUNCHPAD_PRIVATE_KEY or DBC_PAYER_KEYPAIR_PATH for claim and for pay/distribute/buyback.
 * Deployer fee % is tiered by rating (snapshotted at token creation). Rating >= 60 => 30%; below 60 scaled back; remainder goes to community (holders/burn/LP/buys).
 */

import { Connection } from "@solana/web3.js";
import { getDb } from "./db";
import { loadLaunchpadKeypair } from "./launchpad-keypair";
import { claimPartnerTradingFees } from "./fee-collection-service";
import { getHolders } from "./holders";
import { calculateRewards, distributeRewardsSol } from "./distribute";
import { payCreatorCut, buybackAndBurn, buybackOnly } from "./split-actions";
import { runDistributorEpoch } from "./fee-distributor/distributor-onchain";

/** Rating 0-100 -> deployer fee % of trading fees. >=60 => 30%; below 60 tiered; remainder goes to community. */
export function getDeployerFeePctFromRating(ratingScore: number | null | undefined): number {
  if (ratingScore == null || ratingScore < 20) return 0;
  if (ratingScore >= 60) return 30;
  if (ratingScore >= 50) return 20;
  if (ratingScore >= 40) return 15;
  if (ratingScore >= 30) return 10;
  if (ratingScore >= 20) return 5;
  return 0;
}

export interface DistributionSplit {
  holdersPct: number;
  creatorPct: number;
  buysPct?: number;
  burnPct: number;
  lpPct: number;
  creatorWallet?: string | null;
  burnOnBuyback?: boolean;
}

export interface RunCycleParams {
  mint: string;
  distributionSplit: DistributionSplit;
  /** Deployer rating at token creation; used for fee tier. If null, current profile rating is used. */
  deployerRatingAtLaunch?: number | null;
  minHolderBalance?: number | bigint;
  excludeWallet?: string | null;
}

export interface RunCycleResult {
  success: boolean;
  mint: string;
  claimed?: number;
  creatorPaid?: number;
  holderRewards?: { recipients: number; totalLamports: number; signatures: string[] };
  buybackBurned?: number;
  error?: string;
}

function getConnection(): Connection {
  const rpc = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
  if (!rpc) throw new Error("RPC_URL or NEXT_PUBLIC_RPC_URL required");
  return new Connection(rpc, "confirmed");
}

/**
 * Run one rewards cycle: claim partner trading fees, then apply distribution split.
 * Deployer gets a % of fees by rating tier (snapshotted at launch); remainder goes to community (holders/burn/LP/buys) using the stored split ratios.
 */
export async function runCycle(params: RunCycleParams): Promise<RunCycleResult> {
  const { mint, distributionSplit, deployerRatingAtLaunch, minHolderBalance = BigInt(1), excludeWallet } = params;
  const connection = getConnection();
  const keypair = loadLaunchpadKeypair();
  const result: RunCycleResult = { success: false, mint };

  const claimResult = await claimPartnerTradingFees(mint);
  if (!claimResult.success || claimResult.claimedAmount == null) {
    result.error = claimResult.error ?? "Claim failed or nothing to claim";
    return result;
  }
  result.claimed = claimResult.claimedAmount;
  const claimedLamports = Math.floor(claimResult.claimedAmount * 1e9);
  if (claimedLamports <= 0) {
    result.success = true;
    return result;
  }

  const { holdersPct, creatorPct, buysPct = 0, burnPct, lpPct = 0, creatorWallet, burnOnBuyback } = distributionSplit;
  const db = getDb();
  const profile = creatorWallet ? await db.getDeployerProfile(creatorWallet) : null;
  const rating = deployerRatingAtLaunch ?? profile?.rating_score ?? 0;
  const effectiveCreatorPct = getDeployerFeePctFromRating(rating);
  const creatorLamports = Math.floor((claimedLamports * effectiveCreatorPct) / 100);
  const communityLamports = claimedLamports - creatorLamports;

  if (creatorLamports > 0 && creatorWallet) {
    const pay = await payCreatorCut({
      connection,
      payerKeypair: keypair,
      creatorWallet,
      lamports: creatorLamports,
    });
    if (pay.success) result.creatorPaid = creatorLamports / 1e9;
  }

  const totalNonCreator = (holdersPct ?? 0) + buysPct + burnPct + lpPct;
  const scale = totalNonCreator > 0 ? communityLamports / totalNonCreator : 0;

  if (buysPct > 0 && scale > 0) {
    const buyLamports = Math.floor(buysPct * scale);
    if (buyLamports > 0) {
      await buybackOnly({
        connection,
        payerKeypair: keypair,
        tokenMint: mint,
        lamports: buyLamports,
      });
    }
  }
  if (burnPct > 0 && burnOnBuyback && scale > 0) {
    const burnLamports = Math.floor(burnPct * scale);
    if (burnLamports > 0) {
      const burn = await buybackAndBurn({
        connection,
        payerKeypair: keypair,
        tokenMint: mint,
        lamports: burnLamports,
      });
      if (burn.success && burn.burnedAmount != null) result.buybackBurned = burn.burnedAmount;
    }
  }

  if ((holdersPct ?? 0) > 0 && scale > 0) {
    const holderLamports = Math.floor((holdersPct ?? 0) * scale);
    if (holderLamports > 0) {
      const { holders, totalBalance } = await getHolders({
        connection,
        mint,
        excludeWallet: excludeWallet ?? keypair.publicKey.toBase58(),
        minBalance: minHolderBalance,
      });
      if (totalBalance > BigInt(0) && holders.length > 0) {
        const rewards = calculateRewards(holders, totalBalance, holderLamports);
        const useDistributor =
          process.env.USE_DISTRIBUTOR_FOR_HOLDERS === "true" || process.env.USE_DISTRIBUTOR_FOR_HOLDERS === "1";
        if (useDistributor && process.env.DISTRIBUTOR_PROGRAM_ID) {
          const allocs = rewards.map((r) => ({ wallet: r.address, lamports: r.rewardLamports }));
          const distResult = await runDistributorEpoch({
            connection,
            authorityKeypair: keypair,
            mint,
            allocations: allocs,
          });
          if (distResult.success && distResult.recipientCount != null && distResult.recipientCount > 0) {
            result.holderRewards = {
              recipients: distResult.recipientCount,
              totalLamports: distResult.totalLamports ?? holderLamports,
              signatures: distResult.fundTxSig ? [distResult.fundTxSig] : [],
            };
          }
          if (distResult.error) result.error = (result.error ?? "") + " " + distResult.error;
        } else {
          const dist = await distributeRewardsSol({
            connection,
            payerKeypair: keypair,
            rewards,
          });
          if (dist.signatures.length) {
            result.holderRewards = {
              recipients: rewards.length,
              totalLamports: holderLamports,
              signatures: dist.signatures,
            };
          }
          if (dist.error) result.error = (result.error ?? "") + " " + dist.error;
        }
      }
    }
  }

  result.success = true;
  return result;
}
