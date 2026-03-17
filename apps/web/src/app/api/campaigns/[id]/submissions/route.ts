/**
 * GET /api/campaigns/[id]/submissions
 * List submissions for a campaign.
 *
 * POST /api/campaigns/[id]/submissions
 * Body: { submitterWallet, contentUrl, description? }
 * Create a submission (shill) for the campaign.
 */

import { getDb } from "@/lib/db";
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
    const submissions = await db.getSubmissionsByCampaign(id);
    return NextResponse.json({ submissions });
  } catch (e) {
    console.error("[campaigns/[id]/submissions GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  let body: { submitterWallet?: string; contentUrl?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const submitterWallet = body.submitterWallet?.trim();
  const contentUrl = body.contentUrl?.trim();
  if (!submitterWallet || !contentUrl) {
    return NextResponse.json({ error: "Missing submitterWallet or contentUrl" }, { status: 400 });
  }
  try {
    const db = getDb();
    const campaign = await db.getCampaign(id);
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    if (campaign.status !== "active") {
      return NextResponse.json({ error: "Campaign is not active" }, { status: 400 });
    }
    const now = new Date();
    const starts = new Date(campaign.starts_at);
    const ends = new Date(campaign.ends_at);
    if (now < starts || now > ends) {
      return NextResponse.json({ error: "Campaign is outside start/end window" }, { status: 400 });
    }
    const result = await db.createSubmission({
      campaign_id: id,
      submitter_wallet: submitterWallet,
      content_url: contentUrl,
      description: body.description?.trim() || null,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
    const submission = await db.getSubmission(result.id);
    return NextResponse.json({ ok: true, submission });
  } catch (e) {
    console.error("[campaigns/[id]/submissions POST]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
