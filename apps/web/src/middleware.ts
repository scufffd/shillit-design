import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const RATE_LIMIT = Number(process.env.API_RATE_LIMIT_PER_MIN) || 30;
const windowMs = 60_000;

// In-memory rate limit (use Redis or Upstash in production for multi-instance).
const hits = new Map<string, { count: number; resetAt: number }>();

function getClientId(req: NextRequest): string {
  return req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "anonymous";
}

function rateLimit(clientId: string): boolean {
  const now = Date.now();
  const entry = hits.get(clientId);
  if (!entry) {
    hits.set(clientId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (now >= entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + windowMs;
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/image/check") || req.nextUrl.pathname.startsWith("/api/cto/submit")) {
    const clientId = getClientId(req);
    if (!rateLimit(clientId)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/image/check", "/api/cto/submit"],
};
