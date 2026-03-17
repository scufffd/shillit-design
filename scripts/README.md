# Scripts

- **rewards-cron** – Refi-style automation: calls `POST /api/rewards/cron` on the web app every N minutes to run buybacks, holder rewards, and fee distribution for all enabled reward loops. Set `REWARDS_CRON_BASE_URL` (e.g. `http://localhost:3000`), optional `REWARDS_CRON_TOKEN` (must match app’s `REWARDS_CRON_TOKEN`), and optional `REWARDS_CRON_INTERVAL_MIN` (default 2). Run with Node: `node scripts/rewards-cron.mjs`. For production, run with pm2: `pm2 start scripts/rewards-cron.mjs --name rewards-cron`.

- **arweave-upload** – Upload image (or metadata) to Arweave via Bundlr. Call after R2 upload; attach returned URI to Metaplex metadata.
- **bagworker-auto-detect-job** – Cron (e.g. every 1–6h): for each token in `tracked_tokens`, search X for tweets containing `search_query` (CA or short link), upsert `detected_tweets`. Requires `X_BEARER_TOKEN`. See `bagworker-auto-detect-job.ts`.
- **bagworker-engagement-job** – Cron at period end: (1) Manual: approved tweets → fetch metrics → aggregate. (2) Auto: `detected_tweets` → fetch current, delta = current − last_*, update last_*, aggregate (linked authors only). Merge both, compute share_pct, upsert `bagworker_engagement`. See `bagworker-engagement-job.ts`.
- **bagworker-distribute** – Cron: claim fees from DBC/treasury and distribute to bagworkers (per share_pct); or trigger on-chain claim. Record in `bagworker_claims`.
- **inactive-tokens** – Cron: scan `inactive_tokens` and set `cto_eligible = true` where `last_trade_at` &gt; 60 days ago and `market_cap_usd` &lt; threshold.

Implement these with Node/TS; use `RPC_URL`, Supabase service key, and Anchor for on-chain calls.
