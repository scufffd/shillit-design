/**
 * POST /api/campaigns/[id]/end
 * Body: { creatorWallet? }
 * Set campaign status to "ended". Optional: only allow if creatorWallet matches.
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  let body: { creatorWallet?: string };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }
  try {
    const db = getDb();
    const campaign = await db.getCampaign(id);
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    if (body.creatorWallet && campaign.creator_wallet !== body.creatorWallet) {
      return NextResponse.json({ error: "Only creator can end campaign" }, { status: 403 });
    }
    const { error } = await db.updateCampaignStatus(id, "ended");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const updated = await db.getCampaign(id);
    return NextResponse.json({ ok: true, campaign: updated });
  } catch (e) {
    console.error("[campaigns/[id]/end]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
