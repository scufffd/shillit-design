/**
 * PATCH /api/admin/cto-claims/[id]
 * Admin only. Body: { adminWallet: string, status?: 'approved' | 'fee_paid', fee_lamports?: number, fee_tx_sig?: string }
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_WALLETS = (process.env.SHILLIT_ADMIN_WALLETS ?? "")
  .split(",")
  .map((w) => w.trim())
  .filter(Boolean);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  let body: { adminWallet?: string; status?: string; fee_lamports?: number; fee_tx_sig?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const adminWallet = body.adminWallet?.trim();
  if (!adminWallet || !ADMIN_WALLETS.includes(adminWallet)) {
    return NextResponse.json({ error: "Unauthorized: admin wallet required" }, { status: 403 });
  }
  const status = body.status === "approved" || body.status === "fee_paid" ? body.status : undefined;
  try {
    const db = getDb();
    const updates: { status?: "approved" | "fee_paid"; fee_lamports?: number | null; fee_tx_sig?: string | null } = {};
    if (status) updates.status = status;
    if (body.fee_lamports !== undefined) updates.fee_lamports = body.fee_lamports;
    if (body.fee_tx_sig !== undefined) updates.fee_tx_sig = body.fee_tx_sig.trim() || null;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }
    const { error } = await db.updateCtoClaimStatus(id, updates);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/cto-claims PATCH]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
