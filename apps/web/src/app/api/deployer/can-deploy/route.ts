/**
 * GET /api/deployer/can-deploy?wallet=...
 * Returns { allowed, reason?, deployCountToday, cap }.
 * allowed is false if wallet has no paid deployer profile or is at or over daily deploy cap.
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_DAILY_CAP = 3;

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim();
  if (!wallet) {
    return NextResponse.json({ error: "Missing query: wallet" }, { status: 400 });
  }
  const cap = Math.max(1, parseInt(process.env.DEPLOYER_DAILY_CAP ?? String(DEFAULT_DAILY_CAP), 10));

  try {
    const db = getDb();
    const profile = await db.getDeployerProfile(wallet);
    if (!profile) {
      return NextResponse.json({
        allowed: false,
        reason: "Create a deployer profile to launch tokens.",
        deployCountToday: 0,
        cap,
      });
    }
    if (!profile.paid_at) {
      return NextResponse.json({
        allowed: false,
        reason: "Pay the profile fee to activate your deployer profile.",
        deployCountToday: 0,
        cap,
      });
    }
    const deployCountToday = await db.getDeployCountForWalletToday(wallet);
    if (deployCountToday >= cap) {
      return NextResponse.json({
        allowed: false,
        reason: `Daily deploy limit reached (${cap} per day). Try again tomorrow.`,
        deployCountToday,
        cap,
      });
    }
    return NextResponse.json({
      allowed: true,
      reason: null,
      deployCountToday,
      cap,
    });
  } catch (e) {
    console.error("[deployer/can-deploy]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
