/**
 * POST /api/bagworker/tracked-tokens
 * Body: { token_mint: string, search_query?: string }
 * Adds a token to tracked_tokens (SQLite or Supabase).
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let body: { token_mint: string; search_query?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token_mint, search_query } = body;
  if (!token_mint || typeof token_mint !== "string") {
    return NextResponse.json({ error: "token_mint required" }, { status: 400 });
  }

  const db = getDb();
  const { error } = await db.upsertTrackedToken({ token_mint: token_mint.trim(), search_query: (search_query ?? token_mint).trim() });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, token_mint: token_mint.trim(), search_query: search_query ?? token_mint });
}
