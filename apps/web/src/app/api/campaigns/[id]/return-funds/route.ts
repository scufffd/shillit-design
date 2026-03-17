/**
 * POST /api/campaigns/[id]/return-funds
 * Return remaining campaign funds from escrow to campaign creator.
 * Callable by: campaign creator (returns to themselves) or an admin.
 * Campaign must be ended. Remaining = funded_lamports - sum(amount_awarded_lamports for paid submissions).
 */

import { getCampaignEscrowKeypair } from "@/lib/campaign-escrow-keypair";
import { getDb } from "@/lib/db";
import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ADMIN_WALLETS = (process.env.SHILLIT_ADMIN_WALLETS ?? "")
  .split(",")
  .map((w) => w.trim())
  .filter(Boolean);

function getConnection(): Connection {
  const rpc = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
  if (!rpc) throw new Error("RPC_URL or NEXT_PUBLIC_RPC_URL required");
  return new Connection(rpc, "confirmed");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  let body: { adminWallet?: string; creatorWallet?: string };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const adminWallet = body.adminWallet?.trim();
  const creatorWallet = body.creatorWallet?.trim();
  const isAdmin = adminWallet && ADMIN_WALLETS.includes(adminWallet);
  try {
    const db = getDb();
    const campaign = await db.getCampaign(id);
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    const allowedAsCreator = creatorWallet && campaign.creator_wallet === creatorWallet;
    if (!isAdmin && !allowedAsCreator) {
      return NextResponse.json(
        { error: "Only the campaign creator or an admin can return funds" },
        { status: 403 }
      );
    }
    if (campaign.status !== "ended") {
      return NextResponse.json({ error: "Campaign must be ended before returning funds" }, { status: 400 });
    }
    const submissions = await db.getSubmissionsByCampaign(id);
    const paidOut = submissions
      .filter((s) => s.status === "approved" && s.payout_tx_sig != null && s.payout_tx_sig !== "")
      .reduce((a, s) => a + s.amount_awarded_lamports, 0);
    const remaining = campaign.funded_lamports - paidOut;
    if (remaining <= 0) {
      return NextResponse.json({ error: "No remaining funds to return" }, { status: 400 });
    }
    const keypair = await getCampaignEscrowKeypair(id);
    const escrowAddress = campaign.escrow_public_key ?? keypair.publicKey.toBase58();
    if (keypair.publicKey.toBase58() !== escrowAddress) {
      return NextResponse.json(
        {
          error: "Escrow private key not available",
          detail: "This campaign's funds are in an escrow wallet we don't have the key for. Check campaign_escrow_keys table for this campaign.",
        },
        { status: 500 }
      );
    }
    const connection = getConnection();
    const escrowBalance = await connection.getBalance(new PublicKey(escrowAddress));
    const FEE_BUFFER_LAMPORTS = 5000;
    const maxFromBalance = Math.max(0, Number(escrowBalance) - FEE_BUFFER_LAMPORTS);
    const lamportsToSend = Math.min(remaining, maxFromBalance);
    if (lamportsToSend <= 0) {
      return NextResponse.json(
        { error: "Escrow has no SOL to return (balance is 0 or too low)" },
        { status: 400 }
      );
    }
    console.log("[return-funds] escrowBalance=%s lamportsToSend=%s remaining=%s", escrowBalance, lamportsToSend, remaining);
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: new PublicKey(campaign.creator_wallet),
        lamports: lamportsToSend,
      })
    );
    try {
      const sig = await connection.sendTransaction(tx, [keypair], { skipPreflight: false });
      await new Promise((r) => setTimeout(r, 500));
      const conf = await connection.confirmTransaction(sig, "confirmed");
      if (conf.value.err) {
        return NextResponse.json({ error: `Return tx failed: ${sig}` }, { status: 500 });
      }
      return NextResponse.json({ ok: true, signature: sig, returnedLamports: lamportsToSend });
    } catch (txErr: unknown) {
      console.error("[campaigns/[id]/return-funds]", txErr);
      const errMessage = txErr instanceof Error ? txErr.message : "Send failed";
      return NextResponse.json(
        {
          error: errMessage,
          debug: { escrowBalance, lamportsToSend, remaining, escrowAddress },
        },
        { status: 500 }
      );
    }
  } catch (e) {
    console.error("[campaigns/[id]/return-funds]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
