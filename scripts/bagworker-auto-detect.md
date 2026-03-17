# Bagworker auto-detect + delta rewards

## Goal

1. **Find tweets** that contain a token’s contract address (CA) using Twitter API v2 Recent Search.
2. **Store** them in `detected_tweets` with author and snapshot metrics.
3. **Each period:** compute **delta** (current metrics − last snapshot), assign score and share; pay only **linked** wallets (author in `bagworker_profiles`). Update snapshot.

## Twitter API

- **Endpoint:** `GET https://api.twitter.com/2/tweets/search/recent`
- **Auth:** OAuth 2.0 App-Only (Bearer token) is enough for search and for **public** metrics (likes, retweets, reply_count). Impressions need the tweet author’s user-context token.
- **Query:** e.g. `query=<token_mint>` if the CA appears in tweets, or a canonical short link (e.g. `shillit.fun/...`) that you index. Note: recent search only covers last **7 days**, so run frequently (e.g. every 1–6 hours).
- **Response:** tweet id, author_id, text, created_at; with `tweet.fields=public_metrics` you get like_count, retweet_count, reply_count. For impressions, call again with the author’s token if they’re in `bagworker_profiles`.

## Env and data

- **X_BEARER_TOKEN** – App-only Bearer token for Twitter API (recent search + public metrics).
- **tracked_tokens** – Supabase table: `token_mint`, `search_query`. Add one row per token; `search_query` is the string to search for (full CA or a short link like `shillit.fun/t/xyz`). Recent search only covers last 7 days, so run discover often.

## Job flow (repeatable every period)

1. **Discover:** For each token we care about, call search/recent with the CA (or short link). For each hit, upsert `detected_tweets` (tweet_id, token_mint, author_x_user_id, author_username, tweet_created_at). Don’t overwrite last_* on existing rows (we need them for delta).
2. **Snapshot for period:** For each row in `detected_tweets`:
   - Fetch **current** metrics (public for all; + impressions if author linked).
   - **Delta** = current − last_*.
   - Update `last_*` and `last_metrics_at`.
3. **Score:** For the current period, aggregate delta per (author_x_user_id, token_mint). Map author_x_user_id → wallet via `bagworker_profiles`; only include linked authors. Compute raw_score from deltas, then share_pct = raw_score / total. Upsert `bagworker_engagement` for this period.
4. **Payout:** Same as manual flow – distribute period fee pool by share_pct; record in `bagworker_claims`. Only linked authors get paid.

## Period length

- **24h:** More responsive; viral tweets get rewarded quickly; next day they only get more if engagement keeps growing.
- **7d:** Fewer jobs; smoother; same “delta” idea.

Use **delta** so the same tweet is rewarded again only when it gains **new** engagement in that period.
