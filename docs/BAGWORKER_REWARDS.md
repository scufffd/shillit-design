# Bagworker Rewards – Design & Math

## Overview

Bagworkers (holders who promote a token via X and other channels) are rewarded with a **share of the trading fees** generated for that token. Shares are weighted by **engagement** on posts that promote the token (impressions, likes, retweets, replies).

We support two ways to count tweets:

1. **Manual submit** – User links X (Sign in with X), submits tweet IDs per token; we verify and fetch metrics. Best for full impression data.
2. **Auto-detect** – We search X for tweets containing the token’s **contract address (CA)** (or a canonical link). Anyone who tweets the CA can earn; we use public metrics (likes, retweets, replies) for everyone, and add **impressions** when the author has linked their X account. Rewards are **repeatable per period** (see below).

---

## 0. Repeatable rewards: why delta, and how often?

**Your question:** Hour 1 someone tweets the CA and gets traction. Hour 2 we reward them. Should they still get rewarded in hour 3, 4, 5…?

**Recommendation: reward on a repeatable basis using *delta* engagement per period.**

- **Period** = fixed window (e.g. 24 hours or 7 days). Fee pool for that token is split once per period.
- **Delta** = engagement *gained in that period* (not lifetime). For each tweet we store last period’s cumulative metrics; this period we fetch current cumulative; **score for this period = current − last** (impressions, likes, retweets, replies).
- So:
  - **Hour 1:** Tweet goes live.
  - **Period 1 (e.g. hours 1–24):** We snapshot metrics at end of period. Score = all engagement in that 24h. They get share of period 1 fee pool.
  - **Period 2 (hours 25–48):** Delta = (metrics at hour 48) − (metrics at hour 24). If the tweet kept getting likes/impressions, they get rewarded again. If it flatlined, delta ≈ 0 and they get nothing that period.
- **Result:** Good tweets get rewarded when they have traction; they keep getting rewarded only while they keep generating *new* engagement. No “one tweet, forever rewards”; no “one-time only” either. Repeatable and fair.

**Period length:** Shorter (e.g. 24h) = more frequent payouts and more responsive to viral moments. Longer (e.g. 7d) = simpler and less noise. A good default is **24h** or **7d**; tunable in config.

**Direct answer (hour 1 / 2 / 3):**  
- Hour 1: Tweet goes live with the CA.  
- Hour 2: If period is 24h, we’re still in period 1; we don’t pay until the period ends (e.g. end of hour 24). So “hour 2 reward” = we’ve *attributed* the tweet and are tracking metrics; payout happens at period end.  
- Hour 3: Still period 1; no second payout.  
- Hour 25 (start of period 2): We compute **delta** engagement (new likes/impressions since hour 24). If that tweet gained more traction in period 2, they get rewarded again. If not, their delta is ~0 and they get nothing that period. So **repeatable every period, but only for new engagement**.

---

## 1. X (Twitter) verification

- **Sign in with X** (OAuth 2.0 + PKCE): User clicks “Link X account” in the app, completes X’s consent flow, and we receive:
  - `x_user_id`, `x_username`
  - Optional: **access token** (user context) so we can fetch **their** tweet metrics (impressions are only available with user-context OAuth).
- We store the link: **wallet ↔ x_user_id** in `bagworker_profiles`. One wallet can link one X account; one X account can link one wallet.
- **Which tweets count**  
- **Manual flow:** Tweets the bagworker has submitted; we verify author = linked X user and set `status = approved`.  
- **Auto-detect flow:** We search X for tweets containing the token CA (or a canonical link). We store each tweet and its author (`x_user_id`). We use **public metrics** (likes, retweets, replies) for any tweet with app-only auth. We add **impressions** only when the author has linked their X account (we use their stored token). So: anyone can earn by tweeting the CA (public metrics); linking X gives an impression boost and lets us send payouts to their wallet.

---

## 2. Engagement → score (weighting formula)

**Goal**: Fair weight per bagworker per token per period, based on effort (reach + engagement).

**Per bagworker, per token, per period (e.g. one week):**

1. **Raw metrics** (from X API for their approved tweets in that period):
   - `impressions` (primary reach)
   - `likes`, `retweets`, `replies` (engagement)

2. **Raw score** (effort formula):

   ```
   raw_score = w_imp * impressions
            + w_like * likes
            + w_retweet * retweets
            + w_reply * replies
   ```

   Suggested weights (tunable in config):

   - `w_imp = 1`   (impressions = primary driver)
   - `w_like = 2`  (like = stronger signal than a passive view)
   - `w_retweet = 3` (retweet = strong amplification)
   - `w_reply = 2` (reply = engagement)

   So: **score = impressions + 2×likes + 3×retweets + 2×replies**

3. **Share (fair weighting vs others)**  
   For a given `token_mint` and `period_id`:

   ```
   total_score = sum(raw_score_i) over all bagworkers i for that token/period
   share_i = raw_score_i / total_score   (0 if total_score == 0)
   ```

   So each bagworker’s **share** is their proportion of total effort. Fees for that token in that period are split by these shares.

---

## 3. Fee distribution flow

1. **Trading fees** for the token accrue (e.g. from Meteora DBC / partner fee). We track “fee pool per token” (on-chain or off-chain ledger).
2. **Periods**: We split time into fixed periods (e.g. weekly). For each period we:
   - Collect approved tweets per bagworker per token.
   - Fetch metrics (impressions + engagement) using the user’s X access token.
   - Compute `raw_score` per bagworker, then `share_i` for that token/period.
3. **Payout**:  
   - **Option A (off-chain)**: We send SOL (or stablecoin) to each bagworker’s wallet according to `share_i * period_fee_pool` (e.g. via backend job + transfer).  
   - **Option B (on-chain claim)**: We store “claimable amount” per wallet/token/period; user calls a “claim” instruction and receives their share from a vault.  

   We record each payout in `bagworker_claims` (wallet, token_mint, period, amount, tx_signature).

---

## 4. Auto-detect: tweets that contain the token CA

**Goal:** Reward anyone who tweets the token’s contract address, without requiring them to submit tweet IDs. Repeatable rewards per period using delta engagement.

**How we find tweets:**

- **Twitter API v2** – [Recent Search](https://developer.x.com/en/docs/twitter-api/tweets/search/api-reference/get-tweets-search-recent): `GET /2/tweets/search/recent?query=<CA or canonical link>` (last 7 days). Run the search regularly (e.g. every 1–6 hours) so we don’t miss tweets.
- **Query:** Use the token’s **mint/CA** (Solana address). If the CA is too long or gets truncated in tweets, use a **canonical short link** (e.g. `shillit.fun/t/AbC123...`) that redirects to the token page and include that URL in the index; search for that URL or a short code.
- For each result: store `tweet_id`, `token_mint`, `author_x_user_id`, `author_username`, `tweet_created_at`. This is the **detected_tweets** table.

**Metrics and delta:**

- **Public metrics** (likes, retweets, reply_count) are available with **app-only** auth for any tweet.
- **Impressions** require the **tweet author’s** user-context token. So:
  - If the author has linked their X account (`bagworker_profiles`), we use their token to fetch impressions for their tweets and add them to the score.
  - If not linked, we still score them using public metrics only; when they link later, we can backfill impressions for past periods if we stored tweet IDs (optional).
- Each period we store a **snapshot** of cumulative metrics per tweet (`last_impressions`, `last_likes`, `last_retweets`, `last_replies`). Next period: fetch current cumulative, compute **delta = current − last**, use delta in the same formula (e.g. `raw_score = w_imp * delta_imp + ...`). Then update the snapshot.

**Who gets paid:**

- **Option A (recommended):** Only pay **linked** wallets. When we compute shares, we only include tweets whose `author_x_user_id` exists in `bagworker_profiles`; we assign share to that wallet. Unlinked authors still “compete” for share (we count their engagement in the total), but the share that would go to them is either rolled into the pool for linked users or left unclaimed. Simpler and avoids paying “anonymous” X users.
- **Option B:** Track “claimable” per `x_user_id`; when they link, they can claim past periods. More complex but maximally inclusive.

**Repeatability:** Same as above: every period we use **delta** engagement; a tweet keeps earning only while it keeps gaining new engagement in that period.

---

## 5. Data model (summary)

| Concept | Storage | Purpose |
|--------|---------|--------|
| Wallet ↔ X link | `bagworker_profiles` | Verify identity; store x_user_id, optional access token for metrics |
| Manual tweets | `bagworker_tweets` | Submitted tweet IDs per token; we verify author and fetch metrics |
| Auto-detected tweets | `detected_tweets` | tweet_id, token_mint, author_x_user_id; last_* metrics for delta |
| Metrics per wallet/token/period | `bagworker_engagement` | impressions, likes, retweets, replies (delta or cumulative per design); raw_score, share_pct |
| Payouts | `bagworker_claims` | wallet, token_mint, period, amount, tx_signature |

---

## 6. Security & fairness

- **Only verified X**: Only wallets with a linked (Sign in with X) account can submit tweets and earn.
- **Only approved tweets**: We only count tweets we’ve verified (author = linked X user; optional content check for token).
- **Impressions from X**: We use X’s official API with the user’s token so we don’t rely on self-reported numbers.
- **Weights and periods**: Weights and period length are configurable (env or DB) so we can tune fairness without code changes.

---

## 7. Config (env / DB)

- `BAGWORKER_W_IMPRESSIONS`, `BAGWORKER_W_LIKES`, `BAGWORKER_W_RETWEETS`, `BAGWORKER_W_REPLIES` (defaults: 1, 2, 3, 2).
- `BAGWORKER_PERIOD_DAYS` (e.g. 7).
- X OAuth: `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_CALLBACK_URL`.
- **X_BEARER_TOKEN** – App-only Bearer for recent search and public metrics (auto-detect).
- **tracked_tokens** (Supabase) – Rows with `token_mint` and `search_query` (CA or short link) for auto-detect.
