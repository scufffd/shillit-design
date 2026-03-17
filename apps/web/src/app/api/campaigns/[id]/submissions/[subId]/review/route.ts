/**
 * POST /api/campaigns/[id]/submissions/[subId]/review
 * Body: { reviewerWallet, status: "approved" | "rejected", amountAwardedLamports?, payoutViews? }
 * Creator reviews a submission. When approving: either pass amountAwardedLamports, or when campaign has
 * rate_per_1k_lamports and max_payout_lamports, pass payoutViews and we compute Payment = (payoutViews/1000)*rate, capped at max.
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; subId: string }> }
) {
  const { id, subId } = await params;
  if (!id || !subId) return NextResponse.json({ error: "Missing id or subId" }, { status: 400 });
  let body: { reviewerWallet?: string; status?: string; amountAwardedLamports?: number; payoutViews?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const reviewerWallet = body.reviewerWallet?.trim();
  const status = body.status === "approved" || body.status === "rejected" ? body.status : undefined;
  if (!reviewerWallet || !status) {
    return NextResponse.json({ error: "Missing reviewerWallet or status (approved|rejected)" }, { status: 400 });
  }

  try {
    const db = getDb();
    const campaign = await db.getCampaign(id);
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    if (campaign.creator_wallet !== reviewerWallet) {
      return NextResponse.json({ error: "Only campaign creator can review" }, { status: 403 });
    }
    const submission = await db.getSubmission(subId);
    if (!submission || submission.campaign_id !== id) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    if (submission.status !== "pending") {
      return NextResponse.json({ error: "Submission already reviewed" }, { status: 400 });
    }

    let amountAwardedLamports = typeof body.amountAwardedLamports === "number" ? body.amountAwardedLamports : 0;
    const payoutViews = typeof body.payoutViews === "number" && body.payoutViews >= 0 ? body.payoutViews : null;

    if (status === "approved") {
      if (amountAwardedLamports <= 0 && payoutViews != null && campaign.rate_per_1k_lamports != null && campaign.rate_per_1k_lamports > 0 && campaign.max_payout_lamports != null) {
        amountAwardedLamports = Math.min(
          campaign.max_payout_lamports,
          Math.floor((payoutViews / 1000) * campaign.rate_per_1k_lamports)
        );
      }
      if (amountAwardedLamports <= 0) {
        return NextResponse.json({ error: "amountAwardedLamports required when approving, or set campaign rate_per_1k and max_payout and pass payoutViews" }, { status: 400 });
      }
    }

    const { error } = await db.updateSubmissionStatus(
      subId,
      status,
      status === "approved" ? amountAwardedLamports : 0,
      reviewerWallet,
      payoutViews ?? undefined
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const updated = await db.getSubmission(subId);
    return NextResponse.json({ ok: true, submission: updated });
  } catch (e) {
    console.error("[campaigns/[id]/submissions/[subId]/review]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
