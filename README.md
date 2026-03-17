# Shill It Launchpad

**Community-first memecoin launchpad on Solana** — rewards long-term holders and bagworkers from token trading fees. Built on Meteora DBC with custom modules for image uniqueness, CTO (Community Takeover), and bagworker rewards.

**Requirements**: Node.js ≥ 18.17, pnpm ≥ 9, Solana CLI, Anchor CLI.

**Using Node 18**: If you use [nvm](https://github.com/nvm-sh/nvm), run `nvm use` in the repo (or `nvm install 18` then `nvm use 18`). The repo includes an `.nvmrc` set to `18`.

## Quick start

1. **Clone Meteora Invent** (DBC trading UI + create flow):
   ```bash
   git clone https://github.com/MeteoraAg/meteora-invent.git ../meteora-invent
   cd ../meteora-invent && pnpm install
   ```
   Then run: `pnpm --filter @meteora-invent/scaffold/fun-launch dev`

2. **Run this repo** (Shill It backend + custom programs + API):
   ```bash
   cp .env.example .env   # fill in keys
   pnpm install
   pnpm dev
   ```

3. **Deploy Anchor programs** (devnet):
   ```bash
   cd packages/anchor && anchor build && anchor deploy --provider.cluster devnet
   ```

See [docs/SETUP.md](docs/SETUP.md) for full setup. Use [TODO.md](TODO.md) and [PROJECT_CHECKLIST.md](PROJECT_CHECKLIST.md) for phased tasks and go-live checklist.

## Repo layout

| Path | Purpose |
|------|--------|
| `apps/web` | Next.js app — image upload, CTO form, treasury dashboard, Shill It branding |
| `packages/anchor` | Anchor workspace: **ShillItRegistry** (image uniqueness PDA), **ShillItCTO** (CTO + Treasury vault) |
| `apps/web/src/app/api` | API routes: image hash check, CTO submit, treasury stats |
| `docs/` | Architecture, setup, security |
| `supabase/migrations` | Schema for `used_images`, inactive token index |
| `scripts/` | Arweave upload, bagworker distribution, cron jobs |

## Security

- Custom programs only: Registry + CTO. DBC is Meteora’s audited program.
- Follow [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) (Zealynx-adapted) and get an audit before mainnet.
- Treasury: Squads multisig (3/5 or 2/3), no single-key control.

## License

Proprietary. See legal disclaimer in docs.
