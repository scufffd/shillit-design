# Shill It – Security Checklist (Zealynx-Adapted, 2026)

Use this before mainnet and during audit prep. **Custom programs only** (Registry + CTO); DBC is Meteora’s audited program.

---

## Authentication & Authority

- [ ] Two-step authority transfer for critical roles (no single tx handover)
- [ ] Treasury and upgrade authority behind **Squads multisig** (3/5 or 2/3)
- [ ] No single EOA with permanent control of treasury or program upgrade
- [ ] Signer checks on every instruction that moves value or changes authority

---

## State & PDAs

- [ ] Unique seeds: `shillit_image_[hash]`, `bagworker_vault_[token_mint]`, `cto_[old_mint]`
- [ ] Bump canonicalization (store/canonicalize bump where required)
- [ ] Close accounts properly when reclaiming rent; no orphan PDAs with SOL
- [ ] Reload account data after every CPI before making decisions

---

## CPI Safety

- [ ] Whitelist CPIs: only Meteora DBC, Token-2022, System, Squads (as designed)
- [ ] PDA signers only; no arbitrary signer from client for vault/treasury
- [ ] Validate all cross-program invoked program IDs against expected list

---

## Math & Overflow

- [ ] Use `checked_*` math (add, sub, mul) everywhere in Rust
- [ ] Prefer `u128` for fee/reward calculations where overflow risk exists
- [ ] No unchecked casts that could truncate amounts

---

## Token-2022

- [ ] Use `transfer_checked` (with decimals) for all token transfers
- [ ] CPI Guard / required extensions validated on mint creation
- [ ] Immutable Owner extension where appropriate
- [ ] No permanent delegate on treasury-held tokens (or documented and minimal)

---

## Edge Cases & UX Safety

- [ ] Slippage and deadline parameters on any swap (Jupiter) integration
- [ ] Recent blockhash / frontrunning mitigation where applicable
- [ ] Idempotency or replay protection for CTO claim and fee claims

---

## Treasury & Fees

- [ ] Treasury vault is PDA; only CTO fee and authorized distribution instructions can move funds
- [ ] Large withdrawals (e.g. CEX listing) behind timelock or multisig threshold
- [ ] No direct transfer from treasury to unverified addresses without governance

---

## Infrastructure & Ops

- [ ] Rate limiting on public API (upload, CTO submit)
- [ ] No hard-coded seeds or keys in repo; use env and config
- [ ] RPC and API keys in secrets (Vercel/Cloudflare), not in client bundle
- [ ] Helius (or similar) alerts for unusual treasury or program activity

---

## Audit & Monitoring

- [ ] Full audit of custom programs (Registry + CTO + Treasury) before mainnet
- [ ] Audit report published (or summarized) on site
- [ ] Bug bounty live (Immunefi or private) with clear scope
- [ ] Pre-launch: 90%+ test coverage, remediation week after audit

---

## Quick Reference

| Area           | Key rule                                              |
|----------------|--------------------------------------------------------|
| PDAs           | Unique seeds, canonical bump, close when done          |
| CPI            | Whitelist programs; PDA signers only                  |
| Math           | `checked_*`, u128 for fees                             |
| Token-2022     | `transfer_checked`, validate extensions                |
| Treasury       | Multisig + timelock for large moves                   |
| Secrets        | Env only; no keys in client or repo                   |
