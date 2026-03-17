#!/usr/bin/env node
/**
 * Rewards cron runner — calls POST /api/rewards/cron on the app every N minutes.
 * Run with pm2 for refi-live style automation of buybacks, holder rewards, etc.
 *
 * Env: REWARDS_CRON_BASE_URL (e.g. http://localhost:3000), REWARDS_CRON_TOKEN, REWARDS_CRON_INTERVAL_MIN (default 2).
 * Example: REWARDS_CRON_BASE_URL=http://localhost:3000 REWARDS_CRON_TOKEN=secret node scripts/rewards-cron.mjs
 * PM2: pm2 start scripts/rewards-cron.mjs --name rewards-cron
 */

const BASE_URL = process.env.REWARDS_CRON_BASE_URL || "http://localhost:3000";
const TOKEN = process.env.REWARDS_CRON_TOKEN || "";
const INTERVAL_MIN = Math.max(1, parseInt(process.env.REWARDS_CRON_INTERVAL_MIN || "2", 10));
const INTERVAL_MS = INTERVAL_MIN * 60 * 1000;

async function run() {
  const url = `${BASE_URL.replace(/\/$/, "")}/api/rewards/cron`;
  const headers = { "Content-Type": "application/json" };
  if (TOKEN) headers["Authorization"] = `Bearer ${TOKEN}`;
  try {
    const res = await fetch(url, { method: "POST", headers });
    const data = await res.json().catch(() => ({}));
    const time = new Date().toISOString();
    if (res.ok) {
      console.log(`[${time}] cron ok ran=${data.ran ?? 0}`, data.results ?? "");
    } else {
      console.error(`[${time}] cron ${res.status}`, data.error ?? data);
    }
  } catch (e) {
    console.error(`[${new Date().toISOString()}] cron fetch failed`, e.message);
  }
}

async function loop() {
  console.log(`Rewards cron started: hitting ${BASE_URL}/api/rewards/cron every ${INTERVAL_MIN} min`);
  for (;;) {
    await run();
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

loop().catch((e) => {
  console.error(e);
  process.exit(1);
});
