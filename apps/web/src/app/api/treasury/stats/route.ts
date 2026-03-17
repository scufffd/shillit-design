/**
 * GET /api/treasury/stats
 * Returns treasury stats for the transparency dashboard.
 * In production: fetch on-chain TreasuryVault balance + total_fees_collected
 * and optionally Helius/Jupiter analytics. Here we return a stub.
 */

import { NextResponse } from "next/server";

const TREASURY_VAULT_PDA = process.env.TREASURY_VAULT_PDA;
const RPC_URL = process.env.RPC_URL;

export async function GET() {
  if (!RPC_URL || !TREASURY_VAULT_PDA) {
    return NextResponse.json(
      {
        balance_lamports: 0,
        total_fees_collected_lamports: 0,
        message: "Treasury not configured; set TREASURY_VAULT_PDA and RPC_URL",
      },
      { status: 200 }
    );
  }

  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [TREASURY_VAULT_PDA, { encoding: "jsonParsed" }],
      }),
    });
    const data = await res.json();
    const balance_lamports =
      data?.result?.value?.lamports ?? 0;

    return NextResponse.json({
      balance_lamports,
      treasury_pda: TREASURY_VAULT_PDA,
      total_fees_collected_lamports: null,
      message:
        "total_fees_collected from program account state; add Anchor fetch in production",
    });
  } catch (e) {
    return NextResponse.json(
      { error: "RPC failed", details: String(e) },
      { status: 502 }
    );
  }
}
