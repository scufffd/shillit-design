/**
 * GET /api/bagworker/callback/x?code=...&state=...
 * X redirects here after user consents. Exchange code for token, fetch user, upsert bagworker_profiles (SQLite or Supabase).
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const xClientId = process.env.X_CLIENT_ID;
const xClientSecret = process.env.X_CLIENT_SECRET;
const callbackUrl = process.env.X_CALLBACK_URL || "";
const frontendSuccessUrl = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/bagworker?linked=1`
  : "http://localhost:3000/bagworker?linked=1";
const frontendErrorUrl = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/bagworker?error=1`
  : "http://localhost:3000/bagworker?error=1";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const errorParam = req.nextUrl.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(frontendErrorUrl);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${frontendErrorUrl}&reason=missing_params`);
  }

  if (!xClientId || !xClientSecret || !callbackUrl) {
    return NextResponse.redirect(`${frontendErrorUrl}&reason=config`);
  }

  const db = getDb();
  const stateRow = await db.getOauthState(state);

  if (!stateRow) {
    return NextResponse.redirect(`${frontendErrorUrl}&reason=invalid_state`);
  }

  const { wallet, code_verifier: codeVerifier } = stateRow;

  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${xClientId}:${xClientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl,
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("X token exchange failed", err);
    return NextResponse.redirect(`${frontendErrorUrl}&reason=token`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const userRes = await fetch("https://api.twitter.com/2/users/me?user.fields=username", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) {
    return NextResponse.redirect(`${frontendErrorUrl}&reason=user`);
  }

  const userData = (await userRes.json()) as { data: { id: string; username: string } };
  const xUserId = userData.data.id;
  const xUsername = userData.data.username;

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  await db.deleteOauthState(state);
  await db.upsertProfile({
    wallet,
    x_user_id: xUserId,
    x_username: xUsername,
    x_access_token_encrypted: tokenData.access_token,
    x_refresh_token_encrypted: tokenData.refresh_token ?? null,
    x_token_expires_at: expiresAt,
  });

  return NextResponse.redirect(frontendSuccessUrl);
}
