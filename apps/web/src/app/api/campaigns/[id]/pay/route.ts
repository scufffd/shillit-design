/**
 * POST /api/campaigns/[id]/pay
 * Body: { payerWallet?, submissionId? }
 * If submissionId: pay that one approved-unpaid submission. Else: pay all approved-unpaid for this campaign.
 * Payer must be campaign creator (or we can allow platform cron). Sends SOL from escrow (launchpad keypair) to submitter.
 */

import { getCampaignEscrowKeypair } from "@/lib/campaign-escrow-keypair";
import { getDb } from "@/lib/db";
import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";

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
  let body: { payerWallet?: string; submissionId?: string };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const submissionId = body.submissionId?.trim();
  try {
    const db = getDb();
    const campaign = await db.getCampaign(id);
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    if (campaign.reward_mint !== "SOL") {
      return NextResponse.json({ error: "Only SOL payouts supported" }, { status: 400 });
    }
    let toPay = submissionId
      ? [await db.getSubmission(submissionId)].filter(Boolean) as Awaited<ReturnType<typeof db.getSubmission>>[]
      : await db.getApprovedUnpaidSubmissions(id);
    toPay = toPay.filter((s) => s && s.campaign_id === id && s.status === "approved" && (s.payout_tx_sig == null || s.payout_tx_sig === "") && s.amount_awarded_lamports > 0);
    if (toPay.length === 0) {
      return NextResponse.json({ error: "No approved unpaid submissions to pay" }, { status: 400 });
    }
    const totalPaid = toPay.reduce((s, x) => s + (x?.amount_awarded_lamports ?? 0), 0);
    const funded = campaign.funded_lamports ?? 0;
    const allSubs = await db.getSubmissionsByCampaign(id);
    const reserved = allSubs
      .filter((s) => s.status === "approved" && s.payout_tx_sig != null && s.payout_tx_sig !== "")
      .reduce((a, s) => a + s.amount_awarded_lamports, 0);
    if (totalPaid + reserved > funded) {
      return NextResponse.json({ error: "Campaign has insufficient funded balance for these payouts" }, { status: 400 });
    }
    const keypair = await getCampaignEscrowKeypair(id);
    const connection = getConnection();
    const signatures: string[] = [];
    for (const sub of toPay) {
      if (!sub || sub.amount_awarded_lamports <= 0) continue;
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: new PublicKey(sub.submitter_wallet),
          lamports: sub.amount_awarded_lamports,
        })
      );
      const sig = await connection.sendTransaction(tx, [keypair], { skipPreflight: false });
      await new Promise((r) => setTimeout(r, 500));
      const conf = await connection.confirmTransaction(sig, "confirmed");
      if (conf.value.err) {
        return NextResponse.json({ error: `Payout tx failed: ${sig}`, partial: signatures }, { status: 500 });
      }
      await db.setSubmissionPayout(sub.id, sig);
      signatures.push(sig);
    }
    return NextResponse.json({ ok: true, payouts: signatures });
  } catch (e) {
    console.error("[campaigns/[id]/pay]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
