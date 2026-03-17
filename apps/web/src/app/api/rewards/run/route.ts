/**
 * POST /api/rewards/run
 * Run one rewards cycle: claim partner fees for a token, then split (creator / holders / buyback).
 * Body: { mint: string, distributionSplit?: { holdersPct, creatorPct, burnPct, lpPct, creatorWallet?, burnOnBuyback? }, minHolderBalance?, excludeWallet? }
 * Optional header: Authorization: Bearer REWARDS_CRON_TOKEN (if set in env).
 */

import { runCycle } from "@/lib/rewards-runner";
import { NextRequest, NextResponse } from "next/server";

const defaultSplit = {
  holdersPct: 50,
  creatorPct: 25,
  buysPct: 0,
  burnPct: 25,
  lpPct: 0,
  burnOnBuyback: true,
};

export async function POST(req: NextRequest) {
  const token = process.env.REWARDS_CRON_TOKEN?.trim();
  if (token) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${token}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  let body: {
    mint?: string;
    distributionSplit?: {
      holdersPct?: number;
      creatorPct?: number;
      buysPct?: number;
      burnPct?: number;
      lpPct?: number;
      creatorWallet?: string | null;
      burnOnBuyback?: boolean;
    };
    minHolderBalance?: number;
    excludeWallet?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const mint = body.mint?.trim();
  if (!mint) return NextResponse.json({ error: "mint required" }, { status: 400 });
  const distributionSplit = {
    holdersPct: body.distributionSplit?.holdersPct ?? defaultSplit.holdersPct,
    creatorPct: body.distributionSplit?.creatorPct ?? defaultSplit.creatorPct,
    buysPct: body.distributionSplit?.buysPct ?? defaultSplit.buysPct,
    burnPct: body.distributionSplit?.burnPct ?? defaultSplit.burnPct,
    lpPct: body.distributionSplit?.lpPct ?? defaultSplit.lpPct,
    creatorWallet: body.distributionSplit?.creatorWallet ?? null,
    burnOnBuyback: body.distributionSplit?.burnOnBuyback ?? defaultSplit.burnOnBuyback,
  };
  try {
    const result = await runCycle({
      mint,
      distributionSplit,
      minHolderBalance: body.minHolderBalance ?? BigInt(1),
      excludeWallet: body.excludeWallet,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[rewards/run]", e);
    return NextResponse.json(
      { success: false, mint, error: e instanceof Error ? e.message : "Run failed" },
      { status: 500 }
    );
  }
}
