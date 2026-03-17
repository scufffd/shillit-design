/**
 * POST /api/webhooks/helius
 * Helius webhook payload: transactions for your launch tokens.
 * Use to update last_trade_at and market_cap; mark tokens inactive when
 * no trades for INACTIVITY_DAYS and MC < MAX_MC_USD_CTO.
 * Verify HELIUS_WEBHOOK_SECRET before processing.
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const webhookSecret = process.env.HELIUS_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 501 }
    );
  }

  const auth = req.headers.get("authorization") || req.nextUrl.searchParams.get("secret");
  if (auth !== webhookSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // TODO: Parse Helius payload; extract mint and timestamp for each transfer/trade.
  // Update inactive_tokens: set last_trade_at = now(), optionally market_cap_usd.
  // Separate cron or job: set cto_eligible = true where last_trade_at < now() - INACTIVITY_DAYS and market_cap_usd < MAX_MC_USD_CTO.
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  return NextResponse.json({
    ok: true,
    message: "Webhook received; indexer logic to be implemented",
    _body_keys: body && typeof body === "object" ? Object.keys(body as object) : [],
  });
}
