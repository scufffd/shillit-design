# Bonding Curve: Meteora DBC + Shill It Uniqueness

We use **Meteora’s Dynamic Bonding Curve (DBC)** via [@meteora-ag/dynamic-bonding-curve-sdk](https://github.com/MeteoraAg/dynamic-bonding-curve-sdk). You create a **config key** once at [launch.meteora.ag](https://launch.meteora.ag) (curve shape, migration threshold, **partner fee %** for Shill It treasury, **creator fee %** for bagworkers). All pools we create use that config, so we control fee usage. **Our twist: one token per image** — we check image hash before create and register it after.

## How Meteora DBC works (we use this)

- **Config key** – Partner (Shill It) creates a config at launch.meteora.ag: curve (e.g. 16 segments), migration threshold, partner fee %, creator fee %, feeClaimer (e.g. Squads multisig). Set `POOL_CONFIG_KEY` and `NEXT_PUBLIC_POOL_CONFIG_KEY` in `.env`.
- **Create pool** – `client.pool.createPool({ baseMint, config, name, symbol, uri, payer, poolCreator })`. Token mint is created by the user (keypair); config defines fees and curve.
- **First buy (optional)** – `client.pool.createPoolWithFirstBuy` with `firstBuyParam` (buyer, buyAmount from `prepareSwapAmountParam(solAmount, NATIVE_MINT, connection)`, minimumAmountOut).
- **Trading** – Pools are tradeable on the DBC; at migration threshold they migrate to DAMM V1 or V2. Users can trade via Jupiter, Meteora UI, etc.
- **Fees** – Partner and creator fees are set in the config key; you have full control over where fees go (e.g. Shill It treasury + bagworkers).

References:

- [Meteora DBC docs](https://docs.meteora.ag/developer-guide/guides/dbc/overview)
- [DBC TypeScript SDK](https://docs.meteora.ag/integration/dynamic-bonding-curve-dbc-integration/dbc-sdk/dbc-typescript-sdk)
- [@meteora-ag/dynamic-bonding-curve-sdk](https://www.npmjs.com/package/@meteora-ag/dynamic-bonding-curve-sdk)

## Our flow

1. **Image check** – User uploads image on `/launch`. We call `POST /api/launch/metadata-uri` which checks hash against `used_images`. If already used → reject (one token per image).
2. **Metadata URI** – Same request stores image and metadata temporarily and returns a URI that serves Metaplex-style JSON (name, symbol, description, image URL).
3. **Create (and optional first buy)** – We build a Meteora DBC transaction:
   - Create only: `buildCreatePoolTx(connection, { baseMint, config, name, symbol, uri, payer, poolCreator })`.
   - Create + initial buy: `buildCreatePoolWithFirstBuyTx(connection, { createPoolParam, firstBuyParam })` with `prepareSwapAmountParam(solAmount, NATIVE_MINT, connection)` for buy amount.
4. **Sign & send** – Mint keypair partialSign; wallet signs the transaction. Send raw and confirm.
5. **Register image** – On success, `POST /api/image/register` with `{ hash, mint }` so the image is tied to this mint.

## Frontend

- **`/launch`** – Wallet connect, image upload, name, ticker, description, optional initial SOL buy. Uses `@solana/wallet-adapter-react` and `lib/meteora-dbc.ts`. Requires `NEXT_PUBLIC_POOL_CONFIG_KEY` in `.env`. Success link to Jupiter swap (SOL–mint).
- **RPC** – Set `NEXT_PUBLIC_RPC_URL` for the wallet connection (mainnet or devnet).

## Fee control

- Partner fee % and creator fee % are set when you create the config key at launch.meteora.ag. No per-token override needed; all Shill It launches use the same config, so you control treasury and bagworker share in one place.

## Summary

| Aspect            | Implementation                          |
|-------------------|------------------------------------------|
| Bonding curve     | Meteora DBC (config key from launch.meteora.ag) |
| Token creation    | SDK `createPool` / `createPoolWithFirstBuy` |
| Buy / sell        | DBC curve then Jupiter / Meteora UI      |
| Uniqueness        | One token per image (hash check + register) |
| Fee control       | Partner + creator % in config key        |
