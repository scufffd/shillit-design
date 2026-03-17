/**
 * Build a Merkle epoch from holder allocations and persist it for the claim API.
 * Matches on-chain leaf hash: sha256("shillit:dist:v1" || mint || epoch_id || recipient || amount_lamports).
 */

import { PublicKey } from "@solana/web3.js";
import { buildMerkleTree, leafHash } from "./merkle";
import {
  getNextEpochId,
  saveEpochFile,
  appendToEpochIndex,
  type FeeEpochFile,
  type FeeEpochIndexItem,
} from "./storage";

export type Allocation = { wallet: string; lamports: number };

export interface PublishEpochResult {
  epochId: number;
  merkleRoot: string;
  totalLamports: number;
  recipientCount: number;
}

/**
 * Build Merkle tree from allocations, write epoch JSON and index. Does not touch the chain.
 */
export function publishEpoch(params: {
  mint: string;
  allocations: Allocation[];
  epochId?: number;
}): PublishEpochResult {
  const { mint, allocations } = params;
  const epochId = params.epochId ?? getNextEpochId(mint);

  const filtered = allocations.filter((a) => a.lamports >= 1);
  if (filtered.length === 0) {
    const totalLamports = 0;
    const data: FeeEpochFile = { mint, epochId, merkleRoot: "", totalLamports, allocations: [] };
    saveEpochFile(data);
    appendToEpochIndex({
      mint,
      epochId,
      merkleRoot: "",
      totalLamports,
      createdAt: new Date().toISOString(),
    });
    return { epochId, merkleRoot: "", totalLamports: 0, recipientCount: 0 };
  }

  const mintPk = new PublicKey(mint);
  const leaves = filtered.map((a) =>
    leafHash({
      mint: Buffer.from(mintPk.toBytes()),
      epochId: BigInt(epochId),
      wallet: Buffer.from(new PublicKey(a.wallet).toBytes()),
      lamports: BigInt(a.lamports),
    })
  );
  const { root } = buildMerkleTree(leaves);
  const totalLamports = filtered.reduce((s, a) => s + a.lamports, 0);
  const merkleRootHex = root.toString("hex");

  const data: FeeEpochFile = {
    mint,
    epochId,
    merkleRoot: merkleRootHex,
    totalLamports,
    allocations: filtered.map((a) => ({ wallet: a.wallet, lamports: a.lamports })),
  };
  saveEpochFile(data);
  appendToEpochIndex({
    mint,
    epochId,
    merkleRoot: merkleRootHex,
    totalLamports,
    createdAt: new Date().toISOString(),
  } as FeeEpochIndexItem);

  return {
    epochId,
    merkleRoot: merkleRootHex,
    totalLamports,
    recipientCount: filtered.length,
  };
}
