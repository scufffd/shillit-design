# Shill It – DBC config

This folder holds the **Meteora DBC configuration** used to create your pool config key. Use it either on [launch.meteora.ag](https://launch.meteora.ag) (manual) or with **Meteora Invent** (CLI).

Reference: [DBC Token Launch Pool – Set your DBC configuration](https://docs.meteora.ag/developer-guide/quick-launch/dbc-token-launch-pool#set-your-dbc-configuration).

## Network must match your app

**The pool config must be created on the same Solana network as your app’s RPC.**  
Shill It is set up for **mainnet**. Create the config on mainnet (default when running the script with a mainnet `RPC_URL`, or at [launch.meteora.ag](https://launch.meteora.ag) on mainnet). For local testing only you can use devnet and a devnet RPC.

## Before using

1. **Replace placeholders** in `dbc_config.jsonc`:
   - `leftoverReceiver` and `feeClaimer`: set both to your **Squads multisig** or **Treasury** pubkey (same as `SQUADS_MULTISIG_PUBKEY` or your fee recipient in `.env`).

## Option A: Create config at launch.meteora.ag

1. Go to [launch.meteora.ag](https://launch.meteora.ag).
2. Create a new config and mirror the values from `config/dbc_config.jsonc`:
   - **Curve:** e.g. buildCurve with ~20% supply on migration, migration quote threshold (e.g. 30 SOL).
   - **Fees:** Partner fee (Shill It treasury), **Creator fee 25%** (bagworkers), pool creation fee 0, first swap with min fee enabled if you want.
   - **Migration:** DAMM v2, 2% LP fee (migrationFeeOption 3).
   - **LP distribution:** 45% partner, 45% creator, 5% partner locked, 5% creator locked (≥10% locked total).
3. Set **fee claimer** to your Squads/Treasury pubkey.
4. Copy the created **config key** into `.env` as `POOL_CONFIG_KEY` and `NEXT_PUBLIC_POOL_CONFIG_KEY`.

## Option B: Create config with the repo script (recommended)

**Requires Node.js >= 18** (e.g. `nvm use 18`; the repo has `.nvmrc` with `18`).

1. Create a keypair for the **payer** (wallet that will pay for the config and sign). Save it as `config/keypair.json` (or set `DBC_PAYER_KEYPAIR_PATH` in `.env` to its path). **Fund it with SOL on mainnet.**
2. In **repo root** `.env` set:
   - `RPC_URL` – mainnet RPC (e.g. `https://mainnet.helius-rpc.com/?api-key=...`). Script default is mainnet.
   - `DBC_PAYER_KEYPAIR_PATH` – path to payer keypair (e.g. `config/keypair.json`)
3. In `config/dbc_config.jsonc` set `dryRun: false` when you’re ready to send the tx.
4. From repo root:
   ```bash
   pnpm install   # if you haven’t (installs DBC SDK at root for the script)
   pnpm create-dbc-config
   ```
   If you don’t have a root `.env`, run with your mainnet RPC:  
   `RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY DBC_PAYER_KEYPAIR_PATH=config/keypair.json node scripts/create-dbc-config.mjs`
5. The script creates a **new** config keypair, sends the createConfig tx, then prints the config public key and saves the keypair to `config/config-keypair.json`. Add the printed config key to `apps/web/.env` (and root `.env` if you use one) as `POOL_CONFIG_KEY` and `NEXT_PUBLIC_POOL_CONFIG_KEY`.

## Option C: Create config with Meteora Invent

1. Clone and install Meteora Invent:
   ```bash
   git clone https://github.com/MeteoraAg/meteora-invent.git ../meteora-invent
   cd ../meteora-invent && pnpm install
   ```
2. Copy this config and set keypair + addresses:
   ```bash
   cp /path/to/shill-it/config/dbc_config.jsonc ../meteora-invent/studio/config/dbc_config.jsonc
   ```
3. In `studio/config/dbc_config.jsonc`, set:
   - `keypairFilePath` to your deployer keypair (or run `pnpm studio generate-keypair`).
   - `leftoverReceiver` and `feeClaimer` to your Squads/Treasury pubkey.
4. Create config (and optionally a pool):
   ```bash
   pnpm studio dbc-create-config   # creates config only; copy config key to .env
   # or
   pnpm studio dbc-create-pool      # creates config + one pool
   pnpm studio dbc-create-pool --config <YOUR_DBC_CONFIG_KEY>   # pool only, using existing config
   ```
5. Put the **config key** in Shill It `.env` as `POOL_CONFIG_KEY` and `NEXT_PUBLIC_POOL_CONFIG_KEY`.

## Shill It–oriented defaults in this file

| Setting | Value | Purpose |
|--------|--------|--------|
| `creatorTradingFeePercentage` | 25 | 25% of trading fees to creator (bagworkers). |
| `partnerLiquidityPercentage` | 45 | Partner (Shill It) claimable LP after migration. |
| `creatorLiquidityPercentage` | 45 | Creator claimable LP after migration. |
| `enableFirstSwapWithMinFee` | true | Creator’s first buy in same tx has minimal fee. |
| `migrationQuoteThreshold` | 30 | Migration when quote reserve reaches ~30 SOL. |
| `percentageSupplyOnMigration` | 20 | 20% of supply migrates to graduated pool. |

Adjust these in the UI or in this JSON to match your tokenomics.
