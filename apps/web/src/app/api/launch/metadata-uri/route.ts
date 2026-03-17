/**
 * POST /api/launch/metadata-uri
 * Body: multipart/form-data with file (image), name, symbol, description.
 * 1. Check image hash — reject if already used (one token per image).
 * 2. If Pinata is configured: upload image + Metaplex metadata to Pinata; return { uri: pinata-metadata-url, hash }.
 * 3. Otherwise: store in-memory and return { uri: local metadata URL, hash, id }.
 */

import { getDb } from "@/lib/db";
import { isPinataConfigured, createTokenMetadataUri } from "@/lib/ipfs-service";
import { setStored } from "@/lib/launch-store";
import { createHash } from "crypto";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function getExternalUrl(website: string, mint: string | null): string | undefined {
  if (website.length > 0) return website;
  if (mint) return `${baseUrl}/t/${mint}`;
  return undefined;
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string)?.trim() || "";
  const symbol = (formData.get("symbol") as string)?.trim() || "";
  const description = (formData.get("description") as string)?.trim() || "";
  const wallet = (formData.get("wallet") as string)?.trim() || null;
  const mint = (formData.get("mint") as string)?.trim() || null;
  const website = (formData.get("website") as string)?.trim() || "";

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Image file required" }, { status: 400 });
  }
  if (!name || !symbol) {
    return NextResponse.json({ error: "Name and symbol required" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");

  try {
    const db = getDb();
    if (wallet) {
      const profile = await db.getDeployerProfile(wallet);
      if (!profile) {
        return NextResponse.json(
          { error: "Create a deployer profile to launch tokens.", code: "NO_PROFILE" },
          { status: 403 }
        );
      }
      if (!profile.paid_at) {
        return NextResponse.json(
          { error: "Pay the profile fee to activate your deployer profile.", code: "PROFILE_UNPAID" },
          { status: 403 }
        );
      }
      const cap = Math.max(1, parseInt(process.env.DEPLOYER_DAILY_CAP ?? "3", 10));
      const deployCountToday = await db.getDeployCountForWalletToday(wallet);
      if (deployCountToday >= cap) {
        return NextResponse.json(
          { error: `Daily deploy limit reached (${cap} per day). Try again tomorrow.`, code: "DEPLOY_CAP" },
          { status: 403 }
        );
      }
    }
    const existing = await db.getUsedImageByHash(hash);
    if (existing) {
      return NextResponse.json(
        { error: "Image already used — each token must be unique.", allowed: false, hash },
        { status: 409 }
      );
    }
  } catch (dbError) {
    console.warn("[metadata-uri] DB unavailable, skipping image-uniqueness check:", dbError);
  }

  const externalUrl = getExternalUrl(website, mint);

  if (isPinataConfigured()) {
    try {
      const filename = (file as File).name || "image.png";
      const uri = await createTokenMetadataUri({
        name,
        symbol,
        description: description || undefined,
        imageBuffer: bytes,
        imageFilename: filename,
        externalUrl,
      });
      return NextResponse.json({ uri, hash, pinata: true });
    } catch (pinataError) {
      const message = pinataError instanceof Error ? pinataError.message : "Metadata upload failed";
      console.error("[metadata-uri] Pinata upload failed:", message, pinataError);
      return NextResponse.json(
        { error: message, pinata: false },
        { status: 502 }
      );
    }
  }

  const id = randomUUID();
  setStored(id, { name, symbol, description, external_url: externalUrl ?? undefined }, bytes);
  const uri = `${baseUrl}/api/launch/metadata/${id}`;
  return NextResponse.json({ uri, hash, id });
}
