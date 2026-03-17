/**
 * GET /api/launch/metadata/[id]
 * Serves Metaplex-style token metadata JSON for the given temporary id (from POST metadata-uri).
 */

import { getStoredMetadata } from "@/lib/launch-store";
import { NextRequest, NextResponse } from "next/server";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const meta = getStoredMetadata(id);
  if (!meta) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const imageUrl = `${baseUrl}/api/launch/image/${id}`;
  const metadata: Record<string, string> = {
    name: meta.name,
    symbol: meta.symbol,
    description: meta.description,
    image: imageUrl,
  };
  if (meta.external_url) metadata.external_url = meta.external_url;
  return NextResponse.json(metadata);
}
