/**
 * Verify that a Solana transaction is a SOL transfer from `sender` to `recipient` of at least `expectedLamports`.
 * Used to confirm deployer profile fee payment.
 */

import { Connection, PublicKey } from "@solana/web3.js";

export async function verifySolTransfer(params: {
  connection: Connection;
  signature: string;
  sender: string;
  recipient: string;
  expectedLamports: number;
}): Promise<{ ok: boolean; error?: string }> {
  const { connection, signature, sender, recipient, expectedLamports } = params;
  try {
    const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
    if (!tx?.meta || tx.meta.err) {
      return { ok: false, error: "Transaction not found or failed" };
    }
    const senderPubkey = new PublicKey(sender);
    const recipientPubkey = new PublicKey(recipient);
    const msg = tx.transaction.message;
    const accountKeys = msg.accountKeys.map((k: { pubkey?: PublicKey } | PublicKey) =>
      typeof k === "object" && k !== null && "pubkey" in k ? (k.pubkey as PublicKey).toBase58() : (k as PublicKey).toBase58()
    );
    const senderIdx = accountKeys.indexOf(senderPubkey.toBase58());
    const recipientIdx = accountKeys.indexOf(recipientPubkey.toBase58());
    if (senderIdx === -1 || recipientIdx === -1) {
      return { ok: false, error: "Sender or recipient not in transaction" };
    }
    let transferred = 0;
    const pre = tx.meta.preBalances[senderIdx] ?? 0;
    const post = tx.meta.postBalances[senderIdx] ?? 0;
    const recipientPre = tx.meta.preBalances[recipientIdx] ?? 0;
    const recipientPost = tx.meta.postBalances[recipientIdx] ?? 0;
    transferred = recipientPost - recipientPre;
    if (transferred < expectedLamports) {
      return { ok: false, error: `Transfer amount ${transferred} less than required ${expectedLamports}` };
    }
    if (pre - post < expectedLamports) {
      return { ok: false, error: "Sender balance change does not match expected payment" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Verification failed" };
  }
}
