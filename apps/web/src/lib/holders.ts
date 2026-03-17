/**
 * Fetch token holders for proportional rewards.
 * Uses RPC getProgramAccounts (SPL Token) so it works with any RPC; optional Helius DAS for large holder sets.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export interface HolderInfo {
  address: string;
  balance: bigint;
}

export interface GetHoldersResult {
  holders: HolderInfo[];
  totalBalance: bigint;
}

const DEFAULT_MIN_BALANCE = BigInt(1);

/**
 * Fetch all holders of a token mint with balance >= minBalance.
 * Excludes PDAs and optionally excludeWallet (e.g. launchpad/dev).
 */
export async function getHolders(params: {
  connection: Connection;
  mint: string;
  excludeWallet?: string | null;
  minBalance?: bigint | number;
}): Promise<GetHoldersResult> {
  const { connection, mint, excludeWallet, minBalance = DEFAULT_MIN_BALANCE } = params;
  const minBal = typeof minBalance === "number" ? BigInt(minBalance) : minBalance;
  const mintPubkey = new PublicKey(mint);

  const accounts = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
    filters: [
      { dataSize: 165 },
      {
        memcmp: {
          offset: 0,
          bytes: mintPubkey.toBase58(),
        },
      },
    ],
  });

  const holders: HolderInfo[] = [];
  const seen = new Set<string>();

  for (const { pubkey, account } of accounts) {
    const parsed = (account as { data?: { parsed?: { info?: { owner?: string; tokenAmount?: { amount: string } } } } }).data?.parsed?.info;
    if (!parsed?.owner || !parsed?.tokenAmount) continue;
    const owner = parsed.owner;
    const amount = parsed.tokenAmount.amount;
    const balance = BigInt(amount);
    if (balance < minBal) continue;
    if (seen.has(owner)) continue;
    try {
      const ownerPk = new PublicKey(owner);
      if (!PublicKey.isOnCurve(ownerPk.toBuffer())) continue;
    } catch {
      continue;
    }
    if (excludeWallet && owner === excludeWallet) continue;
    seen.add(owner);
    holders.push({ address: owner, balance });
  }

  const totalBalance = holders.reduce((sum, h) => sum + h.balance, BigInt(0));
  return { holders, totalBalance };
}

/**
 * Get total supply of a token (sum of all token accounts for the mint).
 */
export async function getTotalSupply(connection: Connection, mint: string): Promise<bigint> {
  const { totalBalance } = await getHolders({
    connection,
    mint,
    minBalance: BigInt(0),
  });
  return totalBalance;
}
