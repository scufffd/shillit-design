/**
 * GET /api/campaigns/[id]/escrow
 * Returns this campaign's escrow public address. Creators send SOL here to fund this campaign.
 */

import { getDb } from "@/lib/db";
import { loadLaunchpadKeypair } from "@/lib/launchpad-keypair";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  try {
    const db = getDb();
    const campaign = await db.getCampaign(id);
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    const escrowAddress = campaign.escrow_public_key ?? loadLaunchpadKeypair().publicKey.toBase58();
    return NextResponse.json({ escrowAddress });
  } catch (e) {
    console.error("[campaigns/[id]/escrow]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
