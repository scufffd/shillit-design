/**
 * POST /api/campaigns/[id]/fund
 * Body: { fundingTxSignature }
 * Verify SOL transfer from campaign creator to campaign escrow (launchpad wallet); set campaign active and store funded_lamports.
 */

import { getDb } from "@/lib/db";
import { loadLaunchpadKeypair } from "@/lib/launchpad-keypair";
import { verifySolTransfer } from "@/lib/verify-profile-payment";
import { Connection } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";

function getConnection(): Connection {
  const rpc = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
  if (!rpc) throw new Error("RPC_URL or NEXT_PUBLIC_RPC_URL required");
  return new Connection(rpc, "confirmed");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  let body: { fundingTxSignature?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const sig = body.fundingTxSignature?.trim();
  if (!sig) return NextResponse.json({ error: "Missing fundingTxSignature" }, { status: 400 });
  try {
    const db = getDb();
    const campaign = await db.getCampaign(id);
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    if (campaign.status !== "draft") {
      return NextResponse.json({ error: "Campaign already funded or not in draft" }, { status: 400 });
    }
    if (campaign.reward_mint !== "SOL") {
      return NextResponse.json({ error: "Only SOL funding is supported for now" }, { status: 400 });
    }
    const lamports = Math.floor(Number(campaign.reward_amount_raw) * 1e9);
    if (!Number.isFinite(lamports) || lamports <= 0) {
      return NextResponse.json({ error: "Invalid reward_amount_raw for SOL" }, { status: 400 });
    }
    const escrow = campaign.escrow_public_key ?? loadLaunchpadKeypair().publicKey.toBase58();
    const connection = getConnection();
    const verify = await verifySolTransfer({
      connection,
      signature: sig,
      sender: campaign.creator_wallet,
      recipient: escrow,
      expectedLamports: lamports,
    });
    if (!verify.ok) {
      return NextResponse.json({ error: verify.error ?? "Funding verification failed" }, { status: 400 });
    }
    const { error } = await db.updateCampaignFunding(id, lamports, sig);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const updated = await db.getCampaign(id);
    return NextResponse.json({ ok: true, campaign: updated });
  } catch (e) {
    console.error("[campaigns/[id]/fund]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
