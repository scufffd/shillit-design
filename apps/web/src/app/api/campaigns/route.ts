/**
 * GET /api/campaigns?tokenMint=... | ?creatorWallet=...
 * List campaigns by token or by creator.
 *
 * POST /api/campaigns
 * Body: { tokenMint, creatorWallet, title, description?, rewardMint, rewardAmountRaw, ... }
 * Create campaign (draft). Generates a campaign-specific escrow keypair; private key stored server-side for pay/return only.
 */

import { getDb } from "@/lib/db";
import { Keypair } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const tokenMint = req.nextUrl.searchParams.get("tokenMint")?.trim();
  const creatorWallet = req.nextUrl.searchParams.get("creatorWallet")?.trim();
  const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10) || 50));
  try {
    const db = getDb();
    let campaigns: Awaited<ReturnType<typeof db.getCampaignsByToken>>;
    if (tokenMint) {
      campaigns = await db.getCampaignsByToken(tokenMint);
    } else if (creatorWallet) {
      campaigns = await db.getCampaignsByCreator(creatorWallet);
    } else {
      campaigns = await db.getActiveCampaigns(limit);
    }
    const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase();
    if (q) {
      campaigns = campaigns.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.token_mint.toLowerCase().includes(q) ||
          (c.description ?? "").toLowerCase().includes(q)
      );
    }
    return NextResponse.json({ campaigns });
  } catch (e) {
    console.error("[campaigns GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let body: {
    tokenMint?: string;
    creatorWallet?: string;
    title?: string;
    description?: string;
    rewardMint?: string;
    rewardAmountRaw?: string;
    holderRequirementRaw?: string;
    holderRequirementMint?: string;
    trackingWindowDays?: number;
    startsAt?: string;
    endsAt?: string;
    contentGuidelines?: string | null;
    platformRequirements?: { min_account_age_days?: number; min_followers?: number; min_raw_views?: number; allowed_communities?: string[] } | null;
    contentRequirements?: string | null;
    ratePer1kLamports?: number | null;
    maxPayoutLamports?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const tokenMint = body.tokenMint?.trim();
  const creatorWallet = body.creatorWallet?.trim();
  const title = body.title?.trim();
  const rewardMint = (body.rewardMint?.trim() || "SOL").toUpperCase();
  const rewardAmountRaw = body.rewardAmountRaw?.trim();
  const startsAt = body.startsAt?.trim();
  const endsAt = body.endsAt?.trim();
  if (!tokenMint || !creatorWallet || !title || !rewardAmountRaw || !startsAt || !endsAt) {
    return NextResponse.json({
      error: "Missing required: tokenMint, creatorWallet, title, rewardAmountRaw, startsAt, endsAt",
    }, { status: 400 });
  }
  try {
    const db = getDb();
    const escrowKeypair = Keypair.generate();
    const escrowPublicKey = escrowKeypair.publicKey.toBase58();
    const secretKeyBase64 = Buffer.from(escrowKeypair.secretKey).toString("base64");
    const result = await db.createCampaign({
      token_mint: tokenMint,
      creator_wallet: creatorWallet,
      title,
      description: body.description?.trim() || null,
      reward_mint: rewardMint,
      reward_amount_raw: rewardAmountRaw,
      holder_requirement_raw: body.holderRequirementRaw?.trim() || null,
      holder_requirement_mint: body.holderRequirementMint?.trim() || null,
      tracking_window_days: Math.max(1, Math.min(365, Number(body.trackingWindowDays) || 7)),
      starts_at: startsAt,
      ends_at: endsAt,
      escrow_public_key: escrowPublicKey,
      content_guidelines: body.contentGuidelines ?? null,
      platform_requirements: body.platformRequirements ?? null,
      content_requirements: body.contentRequirements ?? null,
      rate_per_1k_lamports: body.ratePer1kLamports ?? null,
      max_payout_lamports: body.maxPayoutLamports ?? null,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
    const keyErr = await db.setCampaignEscrowSecret(result.id, secretKeyBase64);
    if (keyErr.error) {
      return NextResponse.json({ error: keyErr.error.message }, { status: 500 });
    }
    const campaign = await db.getCampaign(result.id);
    return NextResponse.json({ ok: true, campaign });
  } catch (e) {
    console.error("[campaigns POST]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
