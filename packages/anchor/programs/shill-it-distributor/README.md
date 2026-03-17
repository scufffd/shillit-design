# Shill It Fee Distributor

Merkle-based SOL distributor so holders can **claim** fee share instead of the platform pushing from a hot wallet (avoids Bubblemaps clustering).

## Build requirement

`anchor build` may fail with `edition2024` errors from transitive deps (e.g. `constant_time_eq`, `blake3`) if the Solana/Anchor Cargo is older. Options:

- **Upgrade toolchain**: Use a Solana/Anchor install that uses Cargo ≥ 1.82 (or a nightly that supports `edition2024`), then run `anchor build` from `packages/anchor`.
- **CI**: Build the program in a container or CI that has the newer toolchain; commit the built `.so` and IDL.

Once built, deploy with `anchor deploy` and set `DISTRIBUTOR_PROGRAM_ID` in the app `.env`.

## Program ID

Default (devnet/localnet): `2R7aLoBFZDDVLUA3wJPKfkz7KApsox3Tqf8Py7GGeHSL`

## Instructions

- `init_mint(mint, authority)` – one-time per token
- `upsert_epoch(epoch_id, merkle_root, total_lamports)` – authority publishes a root
- `fund_vault(lamports)` – anyone can fund the vault PDA
- `claim(epoch_id, amount_lamports, proof)` – permissionless
- `withdraw_vault(lamports)` – authority only
