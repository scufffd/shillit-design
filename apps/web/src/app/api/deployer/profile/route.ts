/**
 * GET /api/deployer/profile?wallet=...
 * Returns deployer profile (public fields). 404 if none.
 *
 * POST /api/deployer/profile
 * Body: { wallet, displayName?, bio?, avatarUrl?, paymentTxSignature? }
 * Create or update profile. If payment is required (no paid profile yet), paymentTxSignature must be provided
 * and must be a SOL transfer from wallet to DEPLOYER_PROFILE_TREASURY_WALLET of at least DEPLOYER_PROFILE_FEE_LAMPORTS.
 */

import { getDb } from "@/lib/db";
import { verifySolTransfer } from "@/lib/verify-profile-payment";
import { Connection } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";

function getConnection(): Connection {
  const rpc = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
  if (!rpc) throw new Error("RPC_URL or NEXT_PUBLIC_RPC_URL required");
  return new Connection(rpc, "confirmed");
}

const DEFAULT_PROFILE_FEE_LAMPORTS = 100_000_000; // 0.1 SOL

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim();
  if (!wallet) {
    return NextResponse.json({ error: "Missing query: wallet" }, { status: 400 });
  }
  try {
    const db = getDb();
    const profile = await db.getDeployerProfile(wallet);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    return NextResponse.json({
      wallet: profile.wallet,
      created_at: profile.created_at,
      paid_at: profile.paid_at,
      display_name: profile.display_name,
      bio: profile.bio,
      avatar_url: profile.avatar_url,
      rating_score: profile.rating_score,
      rating_automated: profile.rating_automated,
      rating_community: profile.rating_community,
      rating_updated_at: profile.rating_updated_at,
    });
  } catch (e) {
    console.error("[deployer/profile GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let body: { wallet: string; displayName?: string; bio?: string; avatarUrl?: string; paymentTxSignature?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const wallet = body.wallet?.trim();
  if (!wallet) {
    return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
  }
  const treasury = process.env.DEPLOYER_PROFILE_TREASURY_WALLET?.trim();
  const feeLamports = Math.max(
    0,
    parseInt(process.env.DEPLOYER_PROFILE_FEE_LAMPORTS ?? String(DEFAULT_PROFILE_FEE_LAMPORTS), 10)
  );
  const requirePayment = Boolean(treasury && feeLamports > 0);

  try {
    const db = getDb();
    const existing = await db.getDeployerProfile(wallet);
    const needsPayment = requirePayment && (!existing || !existing.paid_at);

    if (needsPayment) {
      const sig = body.paymentTxSignature?.trim();
      if (!sig) {
        return NextResponse.json(
          {
            error: "Payment required to create or activate deployer profile",
            requiredLamports: feeLamports,
            treasury,
          },
          { status: 400 }
        );
      }
      const connection = getConnection();
      const verify = await verifySolTransfer({
        connection,
        signature: sig,
        sender: wallet,
        recipient: treasury!,
        expectedLamports: feeLamports,
      });
      if (!verify.ok) {
        return NextResponse.json({ error: verify.error ?? "Payment verification failed" }, { status: 400 });
      }
    }

    const now = new Date().toISOString();
    const updates: Parameters<typeof db.upsertDeployerProfile>[0] = {
      wallet,
      display_name: body.displayName !== undefined ? body.displayName.trim() || null : undefined,
      bio: body.bio !== undefined ? body.bio.trim() || null : undefined,
      avatar_url: body.avatarUrl !== undefined ? body.avatarUrl.trim() || null : undefined,
    };
    if (needsPayment && body.paymentTxSignature) {
      updates.paid_at = now;
      updates.profile_fee_lamports = feeLamports;
    }
    if (!existing) {
      updates.rating_score = 50;
      updates.rating_automated = 50;
      updates.rating_community = 50;
      updates.rating_updated_at = now;
      if (!needsPayment) {
        updates.paid_at = now;
        updates.profile_fee_lamports = 0;
      }
    }
    const { error } = await db.upsertDeployerProfile(updates);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const profile = await db.getDeployerProfile(wallet);
    return NextResponse.json({
      ok: true,
      profile: profile
        ? {
            wallet: profile.wallet,
            created_at: profile.created_at,
            paid_at: profile.paid_at,
            display_name: profile.display_name,
            bio: profile.bio,
            avatar_url: profile.avatar_url,
            rating_score: profile.rating_score,
            rating_automated: profile.rating_automated,
            rating_community: profile.rating_community,
            rating_updated_at: profile.rating_updated_at,
          }
        : null,
    });
  } catch (e) {
    console.error("[deployer/profile POST]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
