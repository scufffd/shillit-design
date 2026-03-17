import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { loadEpochFile } from "@/lib/fee-distributor/storage";
import { buildMerkleTree, getProof, leafHash } from "@/lib/fee-distributor/merkle";

export const dynamic = "force-dynamic";

/**
 * GET /api/distributor/[mint]/epochs/[epochId]/claimable?wallet=...
 * Returns { lamports, proof } for a wallet, plus programId for third-party UIs.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ mint: string; epochId: string }> }) {
  const { mint, epochId } = await params;
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim();
  if (!mint || !epochId) return NextResponse.json({ error: "Missing mint or epochId" }, { status: 400 });
  if (!wallet) return NextResponse.json({ error: "Missing wallet" }, { status: 400 });

  const epochNum = Number(epochId);
  if (!Number.isFinite(epochNum)) return NextResponse.json({ error: "Invalid epochId" }, { status: 400 });
  const data = loadEpochFile(mint, epochNum);
  if (!data) return NextResponse.json({ error: "Epoch not found" }, { status: 404 });

  const allocIndex = data.allocations.findIndex((a) => a.wallet === wallet);
  if (allocIndex < 0) {
    return NextResponse.json({ mint, epochId: epochNum, wallet, lamports: 0, proof: [] });
  }

  const mintPk = new PublicKey(mint);
  const leaves = data.allocations.map((a) =>
    leafHash({
      mint: Buffer.from(mintPk.toBytes()),
      epochId: BigInt(data.epochId),
      wallet: Buffer.from(new PublicKey(a.wallet).toBytes()),
      lamports: BigInt(a.lamports),
    })
  );
  const { root, layers } = buildMerkleTree(leaves);
  const proof = getProof(layers, allocIndex).map((b) => b.toString("hex"));
  const programId = process.env.DISTRIBUTOR_PROGRAM_ID || null;
  return NextResponse.json({
    mint,
    epochId: data.epochId,
    wallet,
    lamports: data.allocations[allocIndex].lamports,
    merkleRoot: root.toString("hex"),
    proof,
    programId,
  });
}

