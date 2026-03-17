# Shill It – Operations & Security

## Rate limiting

- **Upload / CTO**: `API_RATE_LIMIT_PER_MIN` (default 30). Enforced in `apps/web/src/middleware.ts` for `/api/image/check` and `/api/cto/submit`.
- For production at scale, use Redis or Upstash so rate limits are shared across instances.

## Secrets

- Never commit `.env`. Use Vercel/Cloudflare env for deployment.
- RPC, Supabase service role, Bundlr, and Helius webhook secret must stay server-side only.

## Helius webhook

- Create webhook in Helius dashboard for your launch token mints.
- URL: `https://your-domain.com/api/webhooks/helius?secret=YOUR_HELIUS_WEBHOOK_SECRET` or use `Authorization` header.
- Implement parsing in `apps/web/src/app/api/webhooks/helius/route.ts`: update `inactive_tokens` (last_trade_at, market_cap_usd) and a separate job for `cto_eligible`.

## Treasury

- Withdrawals only via Squads multisig (3/5 or 2/3).
- Add a timelock or threshold for large withdrawals (e.g. CEX listing fund).

## Monitoring

- Helius alerts for unusual treasury or program activity.
- Consider a circuit breaker: pause new launches if exploit detected (e.g. feature flag in UI + admin endpoint).
