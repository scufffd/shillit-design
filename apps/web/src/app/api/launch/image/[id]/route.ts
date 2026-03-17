/**
 * GET /api/launch/image/[id]
 * Serves the uploaded image for the given temporary id.
 */

import { getStoredImage } from "@/lib/launch-store";
import { NextRequest, NextResponse } from "next/server";

function contentTypeForBuffer(buf: Buffer): string {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46) return "image/webp";
  return "image/png";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const image = getStoredImage(id);
  if (!image) {
    return new NextResponse("Not found", { status: 404 });
  }
  return new NextResponse(new Uint8Array(image), {
    headers: { "Content-Type": contentTypeForBuffer(image) },
  });
}
