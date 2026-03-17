/**
 * GET /api/token/[mint]/dex-info
 * Fetches token display info from DexScreener: name, symbol, image, price, liquidity, volume, market cap.
 */

import { NextRequest, NextResponse } from "next/server";

const DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex/tokens";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  if (!mint) return NextResponse.json({ error: "Missing mint" }, { status: 400 });
  try {
    const res = await fetch(`${DEXSCREENER_BASE}/${mint}`, { next: { revalidate: 60 } });
    if (!res.ok) {
      return NextResponse.json({ error: "Token not found on DexScreener" }, { status: 404 });
    }
    const data = (await res.json()) as {
      pairs?: Array<{
        chainId?: string;
        baseToken?: { address: string; name: string; symbol: string };
        priceUsd?: string;
        volume?: { h24?: number };
        liquidity?: { usd?: number };
        fdv?: number;
        marketCap?: number;
        info?: { imageUrl?: string };
      }>;
    };
    const pairs = data.pairs ?? [];
    const solanaPairs = pairs.filter((p) => p.chainId === "solana");
    const best = (solanaPairs.length ? solanaPairs : pairs).sort(
      (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
    )[0];
    if (!best?.baseToken) {
      return NextResponse.json({ error: "No pair data for token" }, { status: 404 });
    }
    const priceUsd = best.priceUsd ? parseFloat(best.priceUsd) : undefined;
    const marketCap = best.marketCap ?? best.fdv;
    return NextResponse.json({
      mint: best.baseToken.address,
      name: best.baseToken.name,
      symbol: best.baseToken.symbol,
      imageUrl: best.info?.imageUrl ?? null,
      priceUsd: priceUsd ?? null,
      volumeH24: best.volume?.h24 ?? null,
      liquidityUsd: best.liquidity?.usd ?? null,
      marketCap: marketCap ?? null,
      dexscreenerUrl: `https://dexscreener.com/solana/${mint}`,
    });
  } catch (e) {
    console.error("[token/[mint]/dex-info]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
