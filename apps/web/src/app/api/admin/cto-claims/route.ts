/**
 * GET /api/admin/cto-claims?adminWallet=...&status=...
 * Admin only. Lists CTO claims (optional filter by status).
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_WALLETS = (process.env.SHILLIT_ADMIN_WALLETS ?? "")
  .split(",")
  .map((w) => w.trim())
  .filter(Boolean);

export async function GET(req: NextRequest) {
  const adminWallet = req.nextUrl.searchParams.get("adminWallet")?.trim();
  if (!adminWallet || !ADMIN_WALLETS.includes(adminWallet)) {
    return NextResponse.json({ error: "Unauthorized: admin wallet required" }, { status: 403 });
  }
  const status = req.nextUrl.searchParams.get("status")?.trim() || undefined;
  const validStatus = status && ["pending", "approved", "fee_paid"].includes(status) ? status : undefined;
  try {
    const db = getDb();
    const claims = await db.getCtoClaims(validStatus as "pending" | "approved" | "fee_paid" | undefined);
    return NextResponse.json({ claims });
  } catch (e) {
    console.error("[admin/cto-claims GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
