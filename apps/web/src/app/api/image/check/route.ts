/**
 * POST /api/image/check
 * Body: multipart/form-data with "file" (image) or raw body (binary image).
 * Computes SHA-256 of image bytes; checks used_images (SQLite or Supabase); returns { allowed, hash }.
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

export async function POST(req: NextRequest) {
  let bytes: Buffer;
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json(
          { error: "Missing 'file' in form data" },
          { status: 400 }
        );
      }
      const ab = await file.arrayBuffer();
      bytes = Buffer.from(ab);
    } else {
      bytes = Buffer.from(await req.arrayBuffer());
    }
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (bytes.length === 0) {
    return NextResponse.json(
      { error: "Empty file" },
      { status: 400 }
    );
  }

  const hash = createHash("sha256").update(bytes).digest("hex");
  const db = getDb();
  const existing = await db.getUsedImageByHash(hash);

  if (existing) {
    return NextResponse.json({
      allowed: false,
      hash,
      message: "Image already used — each token must be truly unique.",
    });
  }

  return NextResponse.json({ allowed: true, hash });
}
