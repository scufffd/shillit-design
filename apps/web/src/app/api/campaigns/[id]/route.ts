/**
 * GET /api/campaigns/[id]
 * Get one campaign by id.
 *
 * PATCH /api/campaigns/[id]
 * Update campaign guidelines and payout formula (creator only).
 * Body: { creatorWallet, contentGuidelines?, platformRequirements?, contentRequirements?, ratePer1kLamports?, maxPayoutLamports? }
 */

import { getDb } from "@/lib/db";
import type { CampaignPlatformRequirements } from "@/lib/db/types";
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
    return NextResponse.json(campaign);
  } catch (e) {
    console.error("[campaigns/[id] GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  let body: {
    creatorWallet?: string;
    contentGuidelines?: string | null;
    platformRequirements?: CampaignPlatformRequirements | null;
    contentRequirements?: string | null;
    ratePer1kLamports?: number | null;
    maxPayoutLamports?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const creatorWallet = body.creatorWallet?.trim();
  if (!creatorWallet) return NextResponse.json({ error: "creatorWallet required" }, { status: 400 });
  try {
    const db = getDb();
    const campaign = await db.getCampaign(id);
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    if (campaign.creator_wallet !== creatorWallet) {
      return NextResponse.json({ error: "Only campaign creator can update guidelines" }, { status: 403 });
    }
    const updates: Parameters<typeof db.updateCampaignGuidelines>[1] = {};
    if (body.contentGuidelines !== undefined) updates.content_guidelines = body.contentGuidelines;
    if (body.platformRequirements !== undefined) updates.platform_requirements = body.platformRequirements;
    if (body.contentRequirements !== undefined) updates.content_requirements = body.contentRequirements;
    if (body.ratePer1kLamports !== undefined) updates.rate_per_1k_lamports = body.ratePer1kLamports;
    if (body.maxPayoutLamports !== undefined) updates.max_payout_lamports = body.maxPayoutLamports;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }
    const { error } = await db.updateCampaignGuidelines(id, updates);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const updated = await db.getCampaign(id);
    return NextResponse.json({ ok: true, campaign: updated });
  } catch (e) {
    console.error("[campaigns/[id] PATCH]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
