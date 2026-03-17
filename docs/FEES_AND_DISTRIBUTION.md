# Fees and Distribution (refi-live + fun-launch → Slotmachine)

This doc outlines how to add **creator/partner fee claiming**, **buybacks**, **burns**, **auto LP**, and **proportional holder airdrops** to Slotmachine, by combining patterns from:

- **refi-live** (`/Users/tom/refi/refi-live`) — pump.fun launchpad: claim creator fees, distribution split (holders / creator / burn / LP), proportional rewards, buyback+burn, Raydium LP.
- **fun-launch** (`/Users/tom/snp/bundle/LAUNCHPAD/meteora-invent/scaffolds/fun-launch`) — Meteora DBC: claim partner/creator trading and LP fees via DBC SDK, flywheel (claim → burn or airdrop to holders).

Slotmachine uses **Meteora DBC**, so fee claiming follows fun-launch; distribution split and proportional logic follow refi-live.

---

## 1. Fee claiming (Meteora DBC) — from fun-launch

### SDK usage

- **Client:** `DynamicBondingCurveClient(connection, 'confirmed')`
- **Pool by mint:** `dbcClient.state.getPoolByBaseMint(baseMint)`
- **Fee metrics:** `dbcClient.state.getPoolFeeMetrics(poolAddress)` → `current.partnerQuoteFee`, `current.creatorQuoteFee` (lamports)
- **Creator (user signs):**
  - Trading: `dbcClient.creator.claimCreatorTradingFee({ pool, creator, maxBaseAmount, maxQuoteAmount, payer })`
  - LP (post-migration): `dbcClient.pool.claimCreatorLp({ pool, creator })`
- **Partner (launchpad signs):**
  - Trading: `dbcClient.partner.claimPartnerTradingFee({ pool, feeClaimer, maxBaseAmount, maxQuoteAmount, payer })`
  - LP (post-migration): `dbcClient.pool.claimPartnerLp({ pool, partner })`

### Implementation in Slotmachine

- **Service:** `apps/web/src/lib/fee-collection-service.ts` (or `services/feeCollectionService.ts`)
  - `getClaimableFees(poolAddress | tokenMint)` — resolve pool via `getPoolByBaseMint` if given mint, then `getPoolFeeMetrics`; return partner/creator trading (SOL), partner/creator LP (SOL), `poolMigrated`.
  - `createCreatorTradingFeeClaimTransaction(poolAddress, creatorWallet)` — build unsigned tx for frontend (set `recentBlockhash` + `feePayer` before serialize).
  - `createCreatorLpClaimTransaction(poolAddress, creatorWallet)` — same for creator LP (only if migrated).
  - `claimPartnerTradingFees(poolAddress)` — build, set blockhash, sign with launchpad keypair, send, confirm.
  - `claimPartnerLpFees(poolAddress)` — same for partner LP (only if migrated).
- **Env:** `RPC_URL` or `NEXT_PUBLIC_RPC_URL`, `LAUNCHPAD_PRIVATE_KEY` (base58 or JSON array) for partner claims.
- **APIs:**
  - `GET /api/fees/claimable?pool=...` or `?mint=...` → `getClaimableFees`
  - `POST /api/fees/claim-creator-trading` — body `{ poolAddress, creatorWallet }` → unsigned tx (base64)
  - `POST /api/fees/claim-creator-lp` — same body → unsigned creator LP claim tx
  - `POST /api/fees/claim-partner` — body `{ poolAddress, feeType: 'trading' | 'lp' | 'both' }` → server signs and sends

### Pool list

- Track created pools so we know which to claim: reuse `POST /api/image/register` (already stores mint); add a **pools** store or table: `poolAddress`, `tokenMint`, `creatorWallet`, `createdAt`, `lastFeeCollection`, `totalFeesCollected`. Populate pool address when registering (derive via `getPoolByBaseMint(mint)` or store at launch time).

---

## 2. Distribution split and cycle — from refi-live

### Concept

After claiming (and optionally taking a platform fee), split the balance by configurable percentages:

- **Holders %** — proportional airdrop (SOL or token) to token holders.
- **Creator %** — send SOL to creator wallet.
- **Burn %** — buyback token with SOL, then burn the bought amount (or buyback-only).
- **LP %** — add liquidity (e.g. Meteora post-migration or external AMM); can defer until threshold.

### Config (per token or global)

- `distributionSplit`: `{ holdersPct, creatorPct, burnPct, lpPct, creatorWallet, burnOnBuyback }` (sum = 100).
- Platform: `platformFeePct`, `platformWallet` (taken before split).
- Min to run: `minDistributeSol`, `minClaimSol` (skip claim if below).

### Cycle (runner)

1. **Claim** — partner trading (+ LP if migrated) for that token’s pool.
2. **Platform cut** — transfer `platformFeePct` to platform wallet.
3. **Split** — for each of creator / burn / LP: pay creator, run buyback (and burn), or add to LP (or accumulate for LP).
4. **Holders** — fetch holders (see below), compute proportional rewards, distribute (see below).

---

## 3. Holders and proportional airdrops — from refi-live

### Fetching holders

- **Source:** Helius DAS `getTokenAccounts({ mint, limit, cursor, showZeroBalance: false })` (refi-live uses `helius.rpc.getTokenAccounts`). Alternative: RPC `getTokenLargestAccounts` + pagination if no Helius.
- **Exclude:** PDAs (`!PublicKey.isOnCurve(owner)`), dev/launchpad wallet, balances &lt; `MIN_HOLDER_BALANCE`.
- **Return:** `{ holders: [{ address, balance }], totalBalance }`. Use `totalBalance` or token `totalSupply` for proportion.

**Implementation:** `apps/web/src/lib/holders.ts` — `getHolders({ mint, excludeWallet?, minBalance? })`.

### Proportional reward math (refi-live)

- Per holder: `rewardLamports = (distributableLamports * holder.balance) / totalSupply` (integer division).
- Skip if `rewardLamports < 1`.
- Give rounding remainder to the largest-share holder.
- **Implementation:** `apps/web/src/lib/distribute.ts` — `calculateRewards(holders, totalSupply, distributableLamports)` → array of `{ address, balance, rewardLamports, sharePercent }`.

### Distributing (SOL or token)

- **SOL:** Batch `SystemProgram.transfer` (e.g. 10 per tx), ComputeBudget for priority.
- **Token:** Create ATAs if needed, then batch `createTransferCheckedInstruction` (e.g. 5 per tx). Rent-check: skip sending to wallets that would stay below rent-exempt min.
- **Implementation:** `distribute.ts` — `distributeRewardsSol(holderRewards, payerKeypair)` and `distributeRewardsToken(...)` with batching and optional ATA creation.

---

## 4. Buyback and burn — from refi-live + fun-launch

- **Buyback:** Swap SOL → token (Jupiter or Meteora swap API for the DBC token). Use slippage (e.g. 10%). Refi uses Jupiter; fun-launch uses Jupiter/Raydium for flywheel burn.
- **Burn:** Only burn the **delta** of token balance (post-buy − pre-buy) via SPL `createBurnCheckedInstruction`, so existing launchpad balance is not burned.
- **Config:** `burnOnBuyback: true` → buy then burn; `false` → buy only (tokens stay in launchpad wallet).
- **Implementation:** `apps/web/src/lib/split-actions.ts` — `buybackAndBurn(mint, amountLamports, payerKeypair)` or `buybackOnly(...)`.

---

## 5. Auto LP (optional)

- **refi-live:** Raydium — if pool exists, add SOL + token; if not, accumulate SOL until threshold then create Raydium CPMM pool.
- **Slotmachine:** For Meteora DBC, post-migration LP is claimed via `claimPartnerLp` / `claimCreatorLp` (already in fee claiming). Adding new liquidity to a graduated pool could use Meteora’s DLMM/AMM APIs or be deferred; document as “future” or mirror Raydium pattern with Meteora pool lookup.

---

## 6. Data and env

### Env (add to `.env.example` and `apps/web/.env`)

| Variable | Purpose |
|----------|---------|
| `LAUNCHPAD_PRIVATE_KEY` | Base58 or JSON array; signs partner claims and distribution txs |
| `HELIUS_API_KEY` | Holder fetch via DAS (if using Helius) |
| `PLATFORM_FEE_PCT` | e.g. 0.05 (5%) taken before split |
| `PLATFORM_WALLET` | SOL recipient for platform fee |
| `MIN_HOLDER_BALANCE` | Min token balance (raw) to qualify for rewards |
| `MIN_DISTRIBUTE_SOL` | Skip distribution if balance below this |
| `DIST_PCT` | Optional: % of available balance to distribute per cycle (e.g. 20) |
| `PRIORITY_FEE` | SOL per tx for ComputeBudget |

### Data (pools, flywheels, distributions)

- **Pools:** Extend current launch tracking: when we register a token (e.g. `/api/image/register`), also store pool address (from `getPoolByBaseMint(mint)`) and creator. Table or JSON: `poolAddress`, `tokenMint`, `tokenSymbol`, `creatorWallet`, `createdAt`, `lastFeeCollection`, `totalFeesCollected`.
- **Per-token config:** Distribution split, creator wallet, burn-on-buyback, LP threshold. Store in DB or `data/token-config.json` / `data/flywheels.json` (fun-launch style).
- **Distributions / recipients:** Optional history (refi: `recipients.json`; fun-launch: `distributions.json`, `recipients.json`). Can add once basic flow works.

---

## 7. API and cron summary

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/fees/claimable` | GET | Claimable fee breakdown (query: `pool` or `mint`) |
| `/api/fees/claim-creator-trading` | POST | Unsigned creator trading-fee claim tx |
| `/api/fees/claim-creator-lp` | POST | Unsigned creator LP claim tx |
| `/api/fees/claim-partner` | POST | Claim partner trading/LP (server-signed) |
| `/api/fees/claim-partner-all` | POST | Loop pools, claim partner for each (optional) |
| `/api/rewards/run` | POST | One cycle: claim → split → holders → distribute (optional body: `mint` or `pool`) |
| `/api/rewards/status` | GET | Status of runner / last run (optional) |

**Cron:** External scheduler (e.g. cron job or Vercel cron) POSTs to `/api/rewards/run` or `/api/fees/claim-partner-all` on an interval; protect with `REWARDS_CRON_TOKEN` or similar.

---

## 8. Implemented in Slotmachine

**Phase 1 — Fee claiming** (`apps/web/src/lib/fee-collection-service.ts`, `apps/web/src/app/api/fees/*`)

- `getClaimableFees(poolOrMint)`, `resolvePoolAddress()`
- `createCreatorTradingFeeClaimTransaction()`, `createCreatorLpClaimTransaction()` (LP uses `migration.claimDammV1LpToken`)
- `claimPartnerTradingFees()`, `claimPartnerLpFees()`
- APIs: `GET /api/fees/claimable?pool=...|?mint=...`, `POST /api/fees/claim-creator-trading`, `POST /api/fees/claim-creator-lp`, `POST /api/fees/claim-partner`, `POST /api/fees/claim-partner-all`

**Phase 2 — Holders and proportional rewards** (`apps/web/src/lib/holders.ts`, `apps/web/src/lib/distribute.ts`)

- `getHolders({ connection, mint, excludeWallet?, minBalance? })` (RPC getParsedProgramAccounts)
- `calculateRewards(holders, totalSupply, distributableLamports)`, `distributeRewardsSol()` (batched)

**Phase 3 — Split actions** (`apps/web/src/lib/split-actions.ts`)

- `payCreatorCut()` (SOL transfer)
- `buybackAndBurn()` (Jupiter quote + swap, then burn delta via SPL)

**Phase 4 — Runner and cron** (`apps/web/src/lib/rewards-runner.ts`, `apps/web/src/app/api/rewards/*`)

- `runCycle({ mint, distributionSplit, ... })`: claim → creator cut → buyback/burn → holder rewards
- `POST /api/rewards/run` (body: mint, distributionSplit; optional `Authorization: Bearer REWARDS_CRON_TOKEN`)
- `GET /api/rewards/status` (optional `?mint=...` for claimable fees)

**Env:** `LAUNCHPAD_PRIVATE_KEY` (required for partner claim and runner), optional `REWARDS_CRON_TOKEN`, `PLATFORM_FEE_PCT`, `PLATFORM_WALLET`, `MIN_HOLDER_BALANCE` (see `.env.example`).

**Deployer fee tier (rating at launch):** Trading fees are split by deployer rating (snapshotted when the token is registered). Rating ≥60 → deployer gets 30%, 70% to community (holders/burn/LP/buys). Rating 50–59 → 20%; 40–49 → 15%; 30–39 → 10%; 20–29 → 5%; &lt;20 → 0%. The remainder of the 30% (when rating &lt;60) goes to the community bucket. Snapshot is stored in `token_creators.deployer_rating_at_launch` so later rating changes do not affect that token. **Supabase:** add column `deployer_rating_at_launch INTEGER` to `token_creators` if missing.

---

## 9. Implementation phases (reference)

**Phase 1 — Fee claiming (fun-launch)**  
- Add `fee-collection-service.ts` using DBC SDK: `getClaimableFees`, `claimPartnerTradingFees`, `claimPartnerLpFees`, `createCreatorTradingFeeClaimTransaction`, `createCreatorLpClaimTransaction` (with fresh blockhash before serialize/send).  
- Add APIs: `GET /api/fees/claimable`, `POST /api/fees/claim-creator-trading`, `POST /api/fees/claim-creator-lp`, `POST /api/fees/claim-partner`.  
- Ensure pool list: derive pool from mint in register or at claim time.

**Phase 2 — Holders and proportional rewards (refi-live)**  
- Add `holders.ts`: `getHolders({ mint, excludeWallet, minBalance })` (Helius DAS or RPC).  
- Add `distribute.ts`: `calculateRewards(holders, totalSupply, distributableLamports)`, `distributeRewardsSol`, `distributeRewardsToken` (batched).  
- Add runner step: after claim, compute holder rewards from `holdersPct` of balance, then call distribute.

**Phase 3 — Split actions (refi-live)**  
- Add `split-actions.ts`: `payCreatorCut`, `buybackAndBurn`, `buybackOnly` (Jupiter swap + burn delta).  
- Optional: `addToLiquidityPool` (Meteora or Raydium) or document as later.  
- Runner: after claim and platform fee, apply split (creator / burn / LP / holders).

**Phase 4 — Config, data, cron**  
- Per-token config (distribution split, creator wallet, burnOnBuyback).  
- Persist pool list and optional distribution history.  
- Cron endpoint and env for scheduled claim + distribute.

---

## 9. Reference file locations

| Concept | refi-live | fun-launch |
|---------|-----------|------------|
| Claim (creator/partner) | `src/claim.js` (pump) | `src/services/feeCollectionService.ts`, `src/pages/api/claim-partner-fees.ts`, `claim-creator-fees.ts` |
| Holders | `src/holders.js` | (flywheel uses holder list) |
| Proportional rewards | `src/distribute.js` (`calculateRewards`, SOL/token batch) | `src/services/flywheelServiceEnhanced.ts` (`executeAirdropFlywheel`, `airdropToHoldersEnhanced`) |
| Buyback/burn | `src/split-actions.js` | `src/services/flywheelService.ts` (`executeBurnFlywheel`) |
| Runner cycle | `src/runner.js` | `src/pages/api/flywheel-cron.ts` + `flywheelService.executeFlywheel` |
| Pool list | (implicit) | `data/created-pools.json`, registered in `upload.ts` |

Use this doc as the blueprint for implementing fees and distribution in Slotmachine; start with Phase 1 (fee claiming) then add holders, split actions, and cron.

---

## 10. Creator dashboard (refi-live style)

**Implemented:** Token deployers can manage their tokens from a single dashboard.

- **DB:** `token_creators` (token_mint → creator_wallet), `reward_loops` (token_mint, interval_sec, distribution_split JSON, enabled, next_run_at). Creator is stored when registering the token at launch (`POST /api/image/register` with `creator_wallet`).
- **Dashboard page:** `apps/web/src/app/dashboard/page.tsx` — connect wallet, list tokens by creator, select token to see:
  - **Claimable fees** and **Claim creator trading** (unsigned tx → sign in wallet).
  - **Rewards cycle:** Start / Stop / Run now; **Edit reward settings** (distribution split: holders / creator / burn / LP %, creator wallet, burn on buyback).
  - **Dev sell:** 25% / 50% / 75% / 100% (Jupiter token→SOL; unsigned tx → sign in wallet).
- **APIs:**
  - `GET /api/dashboard/tokens?wallet=...` — list tokens for creator.
  - `GET /api/dashboard/tokens/[mint]?wallet=...` — token detail (claimable, reward loop, isCreator).
  - `PATCH /api/dashboard/tokens/[mint]/reward-settings` — body `{ wallet, distributionSplit }` (creator only).
  - `POST /api/rewards/[mint]/start` — body `{ wallet, intervalSec? }` (creator only).
  - `POST /api/rewards/[mint]/stop` — body `{ wallet }` (creator only).
  - `POST /api/rewards/[mint]/run` — body `{ wallet }` (creator) or `Authorization: Bearer REWARDS_CRON_TOKEN`; uses stored distribution_split.
  - `POST /api/rewards/cron` — header `Authorization: Bearer REWARDS_CRON_TOKEN`; runs all enabled reward loops that are due; call every 1–5 min from a cron job.
  - `POST /api/dashboard/tokens/[mint]/sell` — body `{ wallet, percent, slippageBps? }` → `{ swapTransactionBase64 }` (creator only; client signs and sends).
- **Nav:** Dashboard link in header; Launch page registers `creator_wallet` on success.

**Supabase:** If using Supabase, create tables `token_creators` (token_mint TEXT PRIMARY KEY, creator_wallet TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now()) and `reward_loops` (token_mint TEXT PRIMARY KEY, interval_sec INT DEFAULT 300, distribution_split TEXT, enabled INT DEFAULT 0, next_run_at TIMESTAMPTZ, updated_at TIMESTAMPTZ DEFAULT now()). Index on token_creators(creator_wallet).
