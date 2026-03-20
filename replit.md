# Shill It Launchpad

A Solana memecoin launchpad platform. One token per image on Meteora DBC. Set your split, run bagwork campaigns, and get paid on every trade.

## Architecture

**Monorepo** (pnpm workspaces):
- `apps/web` — Next.js 14 frontend + API routes (the main web app)
- `packages/anchor` — Solana Anchor program bindings
- `scripts/` — One-off utility scripts (bagworker, seed, DBC config)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Blockchain**: Solana (web3.js, SPL Token, Wallet Adapter, Meteora DBC SDK)
- **Database**: SQLite (local via `better-sqlite3`) or Supabase (cloud, opt-in)
- **Storage**: Cloudflare R2 (images), Pinata/Arweave (IPFS metadata)
- **Node**: 22.x | **Package manager**: pnpm 10

## Running Locally

The app runs via the "Start application" workflow, which executes:
```
cd apps/web && pnpm dev
```
It binds to `0.0.0.0:5000` for Replit compatibility.

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. Key variables:

| Variable | Description |
|---|---|
| `RPC_URL` | Solana RPC URL (Helius mainnet recommended) |
| `NEXT_PUBLIC_RPC_URL` | Public-facing RPC URL |
| `POOL_CONFIG_KEY` | Meteora DBC config pubkey |
| `R2_*` | Cloudflare R2 credentials for image storage |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional: Supabase URL (leave blank for SQLite) |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional: Supabase service role key |
| `X_CLIENT_ID` / `X_CLIENT_SECRET` | X OAuth2 for bagworker verification |
| `LAUNCHPAD_PRIVATE_KEY` | Wallet for claiming partner fees |

## Database

- **Default (local)**: SQLite at `.data/shillit.db` — no config needed
- **Production**: Set `USE_SUPABASE=1` + `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`

## Design System (shillz.app aesthetic)

Applied full shillz.app terminal/hacker redesign:
- **Fonts**: `Orbitron` (display headings) + `Space Mono` (body/mono — default sans)
- **Colors**: bg `#1d1d1d`, card `#1a1a1a`, accent `#bdfe00` (lime), border `#2a2a2a`, text `#e0dfe3`
- **Style**: Terminal/cyberpunk — `>` prompt prefix, `_` blinking cursor, block-blink animation, uppercase Orbitron headings, sharp (non-rounded) borders, charcoal dark background
- **GitHub**: Synced to `github.com/scufffd/shillit-design` (public)

## Replit Migration Notes

- Updated `apps/web` dev/start scripts to use `-p 5000 -H 0.0.0.0`
- Updated Node engine requirement to `>=20.0.0`
- Upgraded to Node 22 + pnpm 10 for full compatibility
- Added `.npmrc` with `enable-pre-post-scripts=true` for native builds
- Native packages (better-sqlite3, sharp) build via `--config.dangerouslyAllowAllBuilds=true`
