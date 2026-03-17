/**
 * Single DB entry point. Local dev uses SQLite only.
 * When going live with Supabase, set USE_SUPABASE=1 and both Supabase env vars to switch.
 */

import type { Db } from "./types";

let _db: Db | null = null;

function getDb(): Db {
  if (_db) return _db;
  const useSupabase =
    process.env.USE_SUPABASE === "1" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (useSupabase) {
    const { createSupabaseDb } = require("./supabase");
    _db = createSupabaseDb();
  } else {
    const { sqliteDb } = require("./sqlite");
    _db = sqliteDb;
  }
  if (!_db) throw new Error("Db not initialized");
  return _db;
}

export { getDb };
export type { Db } from "./types";
