/**
 * GET /api/admin/cto-config
 * Returns public CTO config (fee wallet) for admin UI. No auth required for read-only config.
 */

import { NextResponse } from "next/server";

export async function GET() {
  const ctoTreasuryWallet = process.env.CTO_TREASURY_WALLET?.trim() || null;
  const ctoFeeLamports = process.env.CTO_FEE_LAMPORTS?.trim()
    ? parseInt(process.env.CTO_FEE_LAMPORTS, 10)
    : null;
  return NextResponse.json({
    ctoTreasuryWallet,
    ctoFeeLamports: Number.isNaN(ctoFeeLamports) ? null : ctoFeeLamports,
  });
}
