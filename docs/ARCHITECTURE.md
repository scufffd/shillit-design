# Shill It – Architecture Overview

## High-level

```
Frontend (Next.js – Shill It branded)
   ├── Wallet Adapter, Jupiter Swap, TradingView charts (via Meteora scaffold or custom)
   ├── Image upload → Backend hash check → R2/Arweave
   └── CTO form, treasury transparency dashboard

Backend (Next.js API routes / optional Cloudflare Workers)
   ├── Supabase: used_images, inactive_tokens
   ├── Helius webhooks: trade monitoring, inactivity detection
   └── Treasury stats & reward distribution API

On-Chain
   ├── Meteora DBC (core launches – no custom code)
   ├── Your DBC Config Key (partner = Shill It feeClaimer)
   ├── ShillItRegistry (image uniqueness PDA)
   ├── ShillItCTO + TreasuryVault (multisig PDA)
   └── Per-token Bagworker Vault PDAs (optional)

Storage
   ├── Cloudflare R2 (images) + Arweave (permanent)
   ├── Helius RPC + webhooks
   ├── Vercel + Squads multisig (treasury)
```

## Data flow

1. **Launch**: User uploads image → API hashes → Supabase + Registry check → store R2/Arweave → create token via DBC with metadata → register hash in ShillItRegistry.
2. **Trading**: All on Meteora DBC then DAMM; partner/creator fees go to treasury and bagworker vaults per your config.
3. **CTO**: Indexer marks inactive/low-MC tokens → new team pays fee to TreasuryVault → `cto_claim` moves metadata/authority and sets “Shill It Backed” flag.
4. **Rewards**: Fee-claim instructions (or cron + Jupiter) move fees to bagworker vaults; holders/stakers claim via your UI.

## Security boundaries

- Only Registry and CTO/Treasury are custom; DBC is Meteora-audited.
- Treasury: Squads multisig only; no single-key withdrawals.
- Image uniqueness: enforced in API + on-chain Registry; create flow must use our API so duplicates are rejected.
