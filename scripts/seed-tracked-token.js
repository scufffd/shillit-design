#!/usr/bin/env node
/**
 * Add a token to tracked_tokens in the local SQLite DB.
 * Usage: node scripts/seed-tracked-token.js <token_mint>
 * Run from repo root. Uses same .data/shillit.db as the app (when app runs via pnpm dev from root).
 */
const path = require("path");
const fs = require("fs");

// Load .env from repo root so DATABASE_PATH can be set
try {
  const envPath = path.resolve(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    content.split("\n").forEach((line) => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    });
  }
} catch (_) {}

const dbPath =
  process.env.DATABASE_PATH ||
  path.join(process.cwd(), ".data", "shillit.db");

const tokenMint = process.argv[2];
if (!tokenMint) {
  console.error("Usage: node scripts/seed-tracked-token.js <token_mint>");
  process.exit(1);
}

// Use better-sqlite3 from apps/web (when run from root, resolve from apps/web)
const appsWeb = path.join(__dirname, "../apps/web");
const Database = require(path.join(appsWeb, "node_modules/better-sqlite3"));

const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbPath);

// Minimal schema for tracked_tokens if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS tracked_tokens (
    id TEXT PRIMARY KEY,
    token_mint TEXT NOT NULL UNIQUE,
    search_query TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const id = require("crypto").randomUUID();
db.prepare(
  "INSERT INTO tracked_tokens (id, token_mint, search_query) VALUES (?, ?, ?) ON CONFLICT(token_mint) DO UPDATE SET search_query = excluded.search_query"
).run(id, tokenMint, tokenMint);

db.close();
console.log("Added to tracked_tokens:", tokenMint);
console.log("DB:", dbPath);
