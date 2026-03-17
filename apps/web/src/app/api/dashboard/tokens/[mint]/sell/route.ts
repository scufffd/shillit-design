/**
 * POST /api/dashboard/tokens/[mint]/sell
 * Body: { wallet: string, percent: number, slippageBps?: number }
 * Builds unsigned Jupiter sell (token → SOL) tx. Only the token creator can request.
 * Returns { swapTransactionBase64 } for the client to sign and send.
 */

import { buildDevSellTransaction } from "@/lib/split-actions";
import { getDb } from "@/lib/db";
import { Connection } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";

function getConnection(): Connection {
  const rpc = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
  if (!rpc) throw new Error("RPC_URL or NEXT_PUBLIC_RPC_URL required");
  return new Connection(rpc, "confirmed");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  if (!mint) return NextResponse.json({ error: "Missing mint" }, { status: 400 });
  let body: { wallet?: string; percent?: number; slippageBps?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const wallet = body.wallet?.trim();
  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });
  const percent = Math.min(100, Math.max(1, Number(body.percent) || 100));
  const slippageBps = typeof body.slippageBps === "number" ? body.slippageBps : 1500;
  try {
    const db = getDb();
    const creator = await db.getCreatorByToken(mint);
    if (creator !== wallet) {
      return NextResponse.json({ error: "Only the token creator can dev sell" }, { status: 403 });
    }
    const connection = getConnection();
    const result = await buildDevSellTransaction({
      connection,
      tokenMint: mint,
      sellerWallet: wallet,
      percent,
      slippageBps,
    });
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      swapTransactionBase64: result.swapTransactionBase64,
      amountRaw: result.amountRaw,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to build sell tx";
    console.error("[dashboard/tokens/[mint]/sell]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
