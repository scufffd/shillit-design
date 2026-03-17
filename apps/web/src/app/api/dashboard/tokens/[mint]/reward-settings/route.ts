/**
 * PATCH /api/dashboard/tokens/[mint]/reward-settings
 * Body: { wallet: string, distributionSplit?: { holdersPct, creatorPct, burnPct, lpPct, creatorWallet?, burnOnBuyback? } }
 * Only the token creator can update. Updates reward_loops.distribution_split (and creates row if needed).
 */

import { getDb } from "@/lib/db";
import type { DistributionSplitDb } from "@/lib/db/types";
import { NextRequest, NextResponse } from "next/server";

function parseSplit(body: unknown): DistributionSplitDb | null {
  if (body == null || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const holdersPct = Number(raw.holdersPct);
  const creatorPct = Number(raw.creatorPct);
  const buysPct = Number(raw.buysPct ?? 0);
  const burnPct = Number(raw.burnPct);
  const lpPct = Number(raw.lpPct ?? 0);
  if (
    !Number.isInteger(holdersPct) ||
    !Number.isInteger(creatorPct) ||
    !Number.isInteger(buysPct) ||
    !Number.isInteger(burnPct) ||
    !Number.isInteger(lpPct) ||
    holdersPct + creatorPct + buysPct + burnPct + lpPct !== 100
  ) {
    return null;
  }
  return {
    holdersPct,
    creatorPct,
    buysPct,
    burnPct,
    lpPct,
    creatorWallet: typeof raw.creatorWallet === "string" ? raw.creatorWallet.trim() || null : null,
    burnOnBuyback: raw.burnOnBuyback !== false,
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  if (!mint) return NextResponse.json({ error: "Missing mint" }, { status: 400 });
  let body: { wallet?: string; distributionSplit?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const wallet = body.wallet?.trim();
  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });
  try {
    const db = getDb();
    const creator = await db.getCreatorByToken(mint);
    if (creator !== wallet) {
      return NextResponse.json({ error: "Only the token creator can update reward settings" }, { status: 403 });
    }
    if (body.distributionSplit !== undefined) {
      const split = parseSplit(body.distributionSplit);
      if (split === null) {
        return NextResponse.json(
          { error: "distributionSplit must be { holdersPct, creatorPct, buysPct, burnPct, lpPct } summing to 100" },
          { status: 400 }
        );
      }
      await db.upsertRewardLoop({ token_mint: mint, distribution_split: split });
    }
    const updated = await db.getRewardLoop(mint);
    return NextResponse.json({ ok: true, rewardLoop: updated });
  } catch (e) {
    console.error("[dashboard/tokens/[mint]/reward-settings]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update" },
      { status: 500 }
    );
  }
}
