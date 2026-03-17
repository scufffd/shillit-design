# Shill It Launchpad – Phased To-Do List

Use this with your project board. Target: **MVP in 8–12 weeks** with 2 devs + 1 designer.

---

## Phase 0: Prep (1–2 days)

- [ ] Create GitHub org/repo: `shill-it/launchpad`
- [ ] Clone Meteora Invent: `git clone https://github.com/MeteoraAg/meteora-invent.git`
- [ ] Create Meteora DBC Config Key on [launch.meteora.ag](https://launch.meteora.ag) — set partner feeClaimer to Squads multisig
- [ ] Set up Cloudflare R2 bucket + API token
- [ ] Create Supabase project (free tier OK)
- [ ] Copy `.env.example` → `.env` and fill RPC, R2, Supabase, POOL_CONFIG_KEY

---

## Phase 1: Core Launchpad (Week 1–2)

- [ ] Run Meteora scaffold: `pnpm --filter @meteora-invent/scaffold/fun-launch dev`
- [ ] Brand UI as "Shill It" (logo, colors, hero: "Build Communities. Reward Bagworkers.")
- [ ] Connect wallet + create-token flow using DBC SDK with `POOL_CONFIG_KEY`
- [ ] Deploy test launches on devnet
- [ ] Add basic analytics page (Helius + Jupiter API)
- [ ] Integrate this repo's API (image hash + CTO) into nav/footer

---

## Phase 2: Uniqueness + Metadata (Week 2–3)

- [ ] Add image upload step in create flow → call Shill It backend `/api/image/check`
- [ ] Backend: compute SHA-256 (or perceptual hash via `sharp`) of image bytes
- [ ] Check Supabase `used_images` → reject duplicates with clear message
- [ ] Store image on R2 + Arweave (Bundlr SDK), get URI
- [ ] Attach to Metaplex Token Metadata (Token-2022) at mint
- [ ] After mint: register hash in ShillItRegistry PDA (immutable on-chain)
- [ ] Run Supabase migration: `used_images` table

---

## Phase 3: Bagworker Rewards + Treasury (Week 3–4)

- [ ] In DBC config: set creator/partner fee %; route partner fees to TreasuryVault PDA
- [ ] Implement fee-claim flow from DBC to TreasuryVault (or Squads)
- [ ] Simple staking or "claim share of fees" for holders (per-token Bagworker Vault)
- [ ] Optional: auto-buyback script (cron + Jupiter) from treasury
- [ ] Treasury transparency dashboard: real-time fee inflows per token

---

## Phase 4: CTO Module (Week 4–6)

- [ ] Helius webhook (or indexer): flag tokens with no trades for 60+ days + MC < $30k
- [ ] Persist eligible tokens in Supabase `inactive_tokens`
- [ ] Frontend CTO form: proposal upload + pay fee (e.g. 50–500 SOL) to TreasuryVault
- [ ] Custom Anchor instruction `cto_claim`: verify inactivity, transfer metadata/update authority, set "Shill It Backed" flag
- [ ] Auto-announce: Twitter bot + in-app banner; allocate marketing from treasury

---

## Phase 5: Testing & Security (Week 6–8)

- [ ] Full test suite: Anchor tests for Registry + CTO
- [ ] Playwright (or similar) for critical UI flows
- [ ] Run [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) (Zealynx-adapted)
- [ ] Commission audit (OtterSec / Neodyme / Kudelski) for custom programs + Token-2022 + vaults
- [ ] Bug bounty (Immunefi or private)
- [ ] Remediation week after audit

---

## Phase 6: Mainnet & Post-Launch (Week 8+)

- [ ] Deploy frontend to Vercel; custom domain (e.g. shillit.fun)
- [ ] Deploy Anchor programs to mainnet
- [ ] Announce on X/Discord; referral system; points leaderboard for bagworkers
- [ ] Weekly treasury reports; CEX listing fund from treasury
- [ ] Rate limiting and anti-bot on uploads and CTO submissions

---

## Ongoing

- [ ] Monitor Helius alerts; circuit breaker (pause new launches) if exploit detected
- [ ] Legal: crypto lawyer review; KYC/AML if needed; disclaimers everywhere
