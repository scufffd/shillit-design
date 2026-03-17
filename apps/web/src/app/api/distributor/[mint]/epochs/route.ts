import { NextRequest, NextResponse } from "next/server";
import { loadEpochIndex } from "@/lib/fee-distributor/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/distributor/[mint]/epochs
 * Public endpoint for terminals to list available claim epochs.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  if (!mint) return NextResponse.json({ error: "Missing mint" }, { status: 400 });
  const all = loadEpochIndex();
  const epochs = all.filter((e) => e.mint === mint).sort((a, b) => b.epochId - a.epochId);
  return NextResponse.json({ mint, epochs });
}

