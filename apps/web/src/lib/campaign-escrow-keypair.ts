/**
 * Load the keypair for a campaign's escrow wallet. Used only by pay and return-funds.
 * Private keys are stored in DB (campaign_escrow_keys) and only accessible server-side.
 * Falls back to launchpad keypair for legacy campaigns without a dedicated escrow.
 */

import { Keypair } from "@solana/web3.js";
import { getDb } from "./db";
import { loadLaunchpadKeypair } from "./launchpad-keypair";

export async function getCampaignEscrowKeypair(campaignId: string): Promise<Keypair> {
  const db = getDb();
  const secretBase64 = await db.getCampaignEscrowSecret(campaignId);
  if (secretBase64) {
    const secret = Buffer.from(secretBase64, "base64");
    return Keypair.fromSecretKey(new Uint8Array(secret));
  }
  return loadLaunchpadKeypair();
}
