/**
 * Meteora Dynamic Bonding Curve (DBC) — token creation and optional first buy.
 * Uses @meteora-ag/dynamic-bonding-curve-sdk with a partner config key (POOL_CONFIG_KEY).
 * Shill It adds: one token per image (check before create, register after).
 */

import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import BN from "bn.js";
import {
  DynamicBondingCurveClient,
  prepareSwapAmountParam,
} from "@meteora-ag/dynamic-bonding-curve-sdk";

export { prepareSwapAmountParam };

export interface CreatePoolParams {
  baseMint: PublicKey;
  config: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  payer: PublicKey;
  poolCreator: PublicKey;
}

/**
 * Build a transaction that creates a DBC pool (no first buy).
 * Caller must set tx.recentBlockhash and tx.feePayer from a fresh getLatestBlockhash()
 * before signing/sending, to avoid "blockhash expired" errors.
 */
export async function buildCreatePoolTx(
  connection: Connection,
  params: CreatePoolParams
): Promise<Transaction> {
  const client = DynamicBondingCurveClient.create(connection, "confirmed");
  return client.pool.createPool(params);
}

export interface CreatePoolWithFirstBuyParams {
  createPoolParam: CreatePoolParams;
  firstBuyParam: {
    buyer: PublicKey;
    buyAmountSol: number;
    minimumAmountOut: BN;
    referralTokenAccount?: PublicKey | null;
  };
}

/**
 * Build a transaction that creates a DBC pool and buys tokens with SOL.
 * Caller must set tx.recentBlockhash and tx.feePayer from a fresh getLatestBlockhash()
 * before signing/sending, to avoid "blockhash expired" errors.
 */
export async function buildCreatePoolWithFirstBuyTx(
  connection: Connection,
  params: CreatePoolWithFirstBuyParams
): Promise<Transaction> {
  const client = DynamicBondingCurveClient.create(connection, "confirmed");
  const buyAmount = await prepareSwapAmountParam(
    params.firstBuyParam.buyAmountSol,
    NATIVE_MINT,
    connection
  );
  return client.pool.createPoolWithFirstBuy({
    createPoolParam: params.createPoolParam,
    firstBuyParam: {
      buyer: params.firstBuyParam.buyer,
      buyAmount,
      minimumAmountOut: params.firstBuyParam.minimumAmountOut,
      referralTokenAccount: params.firstBuyParam.referralTokenAccount ?? null,
    },
  });
}
