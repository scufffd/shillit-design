/**
 * GET /api/bagworker/auth/x?wallet=...
 * Returns { url } for Sign in with X (OAuth 2.0 PKCE). State stored in DB (SQLite or Supabase).
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";

const xClientId = process.env.X_CLIENT_ID;
const callbackUrl = process.env.X_CALLBACK_URL || "";

const SCOPES = ["tweet.read", "users.read", "offline.access"].join(" ");

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sha256Base64Url(input: string): string {
  return base64UrlEncode(createHash("sha256").update(input, "utf-8").digest());
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return NextResponse.json({ error: "Valid wallet address required" }, { status: 400 });
  }

  if (!xClientId || !callbackUrl) {
    return NextResponse.json(
      { error: "X OAuth not configured (X_CLIENT_ID, X_CALLBACK_URL)" },
      { status: 501 }
    );
  }

  const codeVerifier = base64UrlEncode(randomBytes(32));
  const codeChallenge = sha256Base64Url(codeVerifier);
  const state = base64UrlEncode(randomBytes(16));

  const authUrl = `https://twitter.com/i/oauth2/authorize?${new URLSearchParams({
    response_type: "code",
    client_id: xClientId,
    redirect_uri: callbackUrl,
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  }).toString()}`;

  const db = getDb();
  await db.upsertOauthState({ state, wallet, code_verifier: codeVerifier });

  return NextResponse.json({ url: authUrl });
}
