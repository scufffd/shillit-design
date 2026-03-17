# Shill It – Full Setup Guide

## Prerequisites

- Node.js ≥ 18, pnpm ≥ 10
- Solana CLI + Anchor CLI
- Cloudflare account (R2), Supabase account, Helius API key
- Wallet with mainnet SOL (for deployment and DBC config)

## 1. Repo and env

```bash
git clone <your-shill-it-repo> shill-it-launchpad && cd shill-it-launchpad
cp .env.example .env
# Edit .env: RPC_URL, R2_*, SUPABASE_*, POOL_CONFIG_KEY, etc.
pnpm install
# If you switch Node version (e.g. nvm use 18), rebuild native modules:
# cd apps/web && pnpm rebuild:native
```

## 2. Meteora DBC (create flow + trading)

Create your DBC Config Key. A ready-made template lives in **`config/dbc_config.jsonc`** (see [config/README.md](../config/README.md)); use it as reference on [launch.meteora.ag](https://launch.meteora.ag) or with Meteora Invent.

1. Go to [launch.meteora.ag](https://launch.meteora.ag) (or use Meteora Invent: `config/README.md`)
2. Create config: set curve (e.g. 16 segments), migration threshold, **partner fee %** (Shill It treasury), **creator fee %** (bagworkers)
3. Set partner feeClaimer to your **Squads multisig** pubkey
4. Copy the config key into `.env` as `POOL_CONFIG_KEY` and `NEXT_PUBLIC_POOL_CONFIG_KEY`

Clone and run Meteora Invent for the trading UI:

```bash
git clone https://github.com/MeteoraAg/meteora-invent.git ../meteora-invent
cd ../meteora-invent && pnpm install
cp ../shill-it-launchpad/.env.example scaffolds/fun-launch/.env
# Copy R2_*, RPC_URL, POOL_CONFIG_KEY into scaffolds/fun-launch/.env
pnpm --filter @meteora-invent/scaffold/fun-launch dev
```

You can later merge Shill It branding and our API routes into that scaffold.

## 3. Database (SQLite now, Supabase when live)

**Local dev:** Leave `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` unset. The app uses **SQLite** (file at `.data/shillit.db`, created automatically). No extra setup.

**When going live:**  
1. Create a project at [supabase.com](https://supabase.com)  
2. Run the migrations in `supabase/migrations/` (e.g. `supabase db push`)  
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`. The app and API routes will use Supabase instead of SQLite with no code changes.

## 4. Anchor programs (mainnet)

```bash
cd packages/anchor
anchor build
anchor keys list
# ANCHOR_PROVIDER_CLUSTER=mainnet in .env (default). For testing only: devnet
anchor deploy --provider.cluster mainnet
```

Update `.env` with the deployed program IDs and any TreasuryVault PDA you derive.

## 5. Shill It Next.js app

```bash
cd apps/web
pnpm install
pnpm dev
```

- Create token flow: use DBC SDK with `POOL_CONFIG_KEY`; before mint, call `POST /api/image/check` and then register hash on-chain after mint
- CTO: `POST /api/cto/submit` (fee payment + proposal)
- Treasury: `GET /api/treasury/stats` for dashboard

## 6. R2, Pinata, and Arweave

- **R2:** Create bucket `shillit-images`, create API token with R2 edit, put in `.env`
- **Pinata (optional):** For permanent token metadata on IPFS, set `PINATA_JWT` (or `PINATA_API_KEY` + `PINATA_SECRET_API_KEY`) in `apps/web/.env`. Get keys at [pinata.cloud](https://pinata.cloud). If unset, launch still works using in-memory metadata URLs.
- **Arweave:** Use Bundlr; set `BUNDLR_PRIVATE_KEY` (wallet with AR for uploads)

## 7. Helius webhooks (inactivity for CTO)

In Helius dashboard, create webhook for transfers/trades; filter for your launch tokens. Backend handler should update `inactive_tokens` (e.g. no trades for 60 days + MC < threshold). See `apps/web/src/app/api/webhooks/helius/route.ts`.

## 8. Go-live

- Run through [PROJECT_CHECKLIST.md](../PROJECT_CHECKLIST.md) and [SECURITY_CHECKLIST.md](../SECURITY_CHECKLIST.md)
- Deploy Anchor to mainnet; deploy frontend to Vercel; point domain
- Enable monitoring and bug bounty
