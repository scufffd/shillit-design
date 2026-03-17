/**
 * GET /api/cto/config
 * Public. Returns CTO fee wallet and required fee for display on CTO page.
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
