/**
 * GET /api/launch/vamp?mint=...
 * Fetches Metaplex token metadata for a mint and returns name, symbol, description, imageUrl.
 * Used to "vamp" (clone) an existing token's metadata when creating a new token.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

function getConnection(): Connection {
  const rpc = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
  if (!rpc) throw new Error("RPC_URL or NEXT_PUBLIC_RPC_URL required");
  return new Connection(rpc, "confirmed");
}

function readString(buffer: Buffer, offset: number): { value: string; nextOffset: number } {
  const len = buffer.readUInt32LE(offset);
  const value = buffer.subarray(offset + 4, offset + 4 + len).toString("utf8").replace(/\0/g, "").trim();
  return { value, nextOffset: offset + 4 + len };
}

export async function GET(req: NextRequest) {
  const mint = req.nextUrl.searchParams.get("mint")?.trim();
  if (!mint) {
    return NextResponse.json({ error: "Missing mint" }, { status: 400 });
  }
  try {
    const connection = getConnection();
    const mintPubkey = new PublicKey(mint);
    const [metadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
      TOKEN_METADATA_PROGRAM_ID
    );
    const account = await connection.getAccountInfo(metadataPda);
    if (!account?.data || account.data.length < 70) {
      return NextResponse.json({ error: "Token metadata not found for this mint" }, { status: 404 });
    }
    const buf = Buffer.from(account.data);
    const key = buf.readUInt32LE(0);
    if (key !== 4) {
      return NextResponse.json({ error: "Invalid metadata account (not MetadataV1)" }, { status: 400 });
    }
    const nameResult = readString(buf, 68);
    const symbolResult = readString(buf, nameResult.nextOffset);
    const uriResult = readString(buf, symbolResult.nextOffset);
    const name = nameResult.value;
    const symbol = symbolResult.value;
    const uri = uriResult.value;
    if (!uri) {
      return NextResponse.json({ name: name || undefined, symbol: symbol || undefined, description: "" });
    }
    let description = "";
    let imageUrl: string | undefined;
    try {
      const metaRes = await fetch(uri, { signal: AbortSignal.timeout(8000) });
      if (metaRes.ok) {
        const meta = await metaRes.json() as { description?: string; image?: string; image_url?: string };
        description = meta.description ?? "";
        imageUrl = meta.image ?? meta.image_url ?? undefined;
        if (imageUrl && !imageUrl.startsWith("http")) {
          imageUrl = new URL(imageUrl, uri).href;
        }
      }
    } catch {
      // use name/symbol/uri only
    }
    return NextResponse.json({
      name: name || undefined,
      symbol: symbol || undefined,
      description: description || undefined,
      imageUrl: imageUrl || undefined,
    });
  } catch (e) {
    console.error("[launch/vamp]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch token metadata" },
      { status: 500 }
    );
  }
}
