import { NextRequest, NextResponse } from "next/server";
import { PublicKey, Transaction } from "@solana/web3.js";
import { loadEpochFile } from "@/lib/fee-distributor/storage";
import { buildMerkleTree, getProof, leafHash } from "@/lib/fee-distributor/merkle";
import { buildClaimIx } from "@/lib/fee-distributor/anchor-ix";

export const dynamic = "force-dynamic";

/**
 * POST /api/distributor/[mint]/epochs/[epochId]/claim-tx
 * Body: { wallet: string }
 *
 * Returns a base64 unsigned transaction that calls the distributor program's claim instruction.
 * Terminals (Axiom/Padre/etc) can request this and have the user sign+send.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ mint: string; epochId: string }> }) {
  const { mint, epochId } = await params;
  if (!mint || !epochId) return NextResponse.json({ error: "Missing mint or epochId" }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { wallet?: string };
  const wallet = body.wallet?.trim();
  if (!wallet) return NextResponse.json({ error: "Missing wallet" }, { status: 400 });

  const epochNum = Number(epochId);
  if (!Number.isFinite(epochNum)) return NextResponse.json({ error: "Invalid epochId" }, { status: 400 });
  const data = loadEpochFile(mint, epochNum);
  if (!data) return NextResponse.json({ error: "Epoch not found" }, { status: 404 });

  const allocIndex = data.allocations.findIndex((a) => a.wallet === wallet);
  if (allocIndex < 0) {
    return NextResponse.json({ error: "Wallet not in epoch" }, { status: 404 });
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
  const amountLamports = data.allocations[allocIndex].lamports;

  const programId = process.env.DISTRIBUTOR_PROGRAM_ID?.trim();
  if (!programId) {
    return NextResponse.json({
      error: "DISTRIBUTOR_PROGRAM_ID not configured",
      mint,
      epochId: data.epochId,
      wallet,
      lamports: amountLamports,
      merkleRoot: root.toString("hex"),
      proof,
    });
  }

  const recipient = new PublicKey(wallet);
  const ix = buildClaimIx({
    programId: new PublicKey(programId),
    mint: mintPk,
    epochId: BigInt(data.epochId),
    recipient,
    payer: recipient,
    amountLamports: BigInt(amountLamports),
    proof: proof.map((h) => Buffer.from(h, "hex")),
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = new PublicKey(wallet);
  const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
  return NextResponse.json({
    mint,
    epochId: data.epochId,
    wallet,
    lamports: amountLamports,
    merkleRoot: root.toString("hex"),
    proof,
    programId,
    transaction: serialized,
  });
}

