/**
 * Load the launchpad/payer keypair for partner claims and rewards cycle.
 * Used only on the server; never expose keypair or paths to the client.
 *
 * Supports:
 * - LAUNCHPAD_PRIVATE_KEY: base58 string (32- or 64-byte key), or JSON array of 32/64 numbers.
 * - DBC_PAYER_KEYPAIR_PATH: path to a file containing:
 *   - JSON array of 64 numbers (full keypair), or 32 numbers (secret key only), or
 *   - A single base58 string (with or without JSON quotes), e.g. from Phantom export.
 */

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

function resolveKeypairPath(pathEnv: string): string {
  if (pathEnv.startsWith("/")) return pathEnv;
  const fromCwd = resolve(process.cwd(), pathEnv);
  if (existsSync(fromCwd)) return fromCwd;
  const fromMonorepoRoot = resolve(process.cwd(), "..", "..", pathEnv);
  if (existsSync(fromMonorepoRoot)) return fromMonorepoRoot;
  return fromCwd;
}

function bytesToKeypair(bytes: Uint8Array): Keypair {
  if (bytes.length === 64) return Keypair.fromSecretKey(bytes);
  if (bytes.length === 32) return Keypair.fromSeed(bytes);
  throw new Error("Key must be 32 bytes (secret) or 64 bytes (keypair)");
}

export function loadLaunchpadKeypair(): Keypair {
  const raw = process.env.LAUNCHPAD_PRIVATE_KEY?.trim();
  if (raw) {
    const bytes = raw.startsWith("[") ? new Uint8Array(JSON.parse(raw)) : bs58.decode(raw);
    return bytesToKeypair(bytes);
  }
  const pathEnv = process.env.DBC_PAYER_KEYPAIR_PATH?.trim();
  if (pathEnv) {
    const keypairPath = resolveKeypairPath(pathEnv);
    try {
      const content = readFileSync(keypairPath, "utf-8").trim();
      let bytes: Uint8Array;
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          bytes = new Uint8Array(parsed);
        } else if (typeof parsed === "string") {
          bytes = new Uint8Array(bs58.decode(parsed));
        } else {
          throw new Error("Invalid keypair format");
        }
      } catch {
        bytes = new Uint8Array(bs58.decode(content));
      }
      return bytesToKeypair(bytes);
    } catch (e) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as Error).message) : "";
      if (e instanceof SyntaxError || msg.includes("Key must be")) {
        throw new Error("Invalid keypair format: use 32- or 64-byte key (base58 or JSON array)");
      }
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(
          "Keypair file not found. Set DBC_PAYER_KEYPAIR_PATH (e.g. config/keypair.json from repo root) or LAUNCHPAD_PRIVATE_KEY."
        );
      }
      throw e;
    }
  }
  throw new Error(
    "LAUNCHPAD_PRIVATE_KEY or DBC_PAYER_KEYPAIR_PATH required (for partner claims and rewards cycle)"
  );
}
