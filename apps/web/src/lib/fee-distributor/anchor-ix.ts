import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import crypto from "crypto";

const SEED_CONFIG = Buffer.from("shillit_dist_cfg", "utf8");
const SEED_VAULT = Buffer.from("shillit_dist_vault", "utf8");
const SEED_EPOCH = Buffer.from("shillit_dist_epoch", "utf8");
const SEED_CLAIM = Buffer.from("shillit_dist_claim", "utf8");

function discriminator(name: string): Buffer {
  // Anchor: first 8 bytes of sha256("global:<name>")
  const h = crypto.createHash("sha256").update(`global:${name}`).digest();
  return h.subarray(0, 8);
}

function u64LE(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

function u32LE(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
}

export function deriveDistributorPdas(params: {
  programId: PublicKey;
  mint: PublicKey;
  epochId?: bigint;
  recipient?: PublicKey;
}) {
  const config = PublicKey.findProgramAddressSync([SEED_CONFIG, params.mint.toBuffer()], params.programId)[0];
  const vault = PublicKey.findProgramAddressSync([SEED_VAULT, params.mint.toBuffer()], params.programId)[0];
  const epoch =
    params.epochId != null
      ? PublicKey.findProgramAddressSync(
          [SEED_EPOCH, params.mint.toBuffer(), u64LE(params.epochId)],
          params.programId
        )[0]
      : null;
  const claimStatus =
    epoch != null && params.recipient != null
      ? PublicKey.findProgramAddressSync([SEED_CLAIM, epoch.toBuffer(), params.recipient.toBuffer()], params.programId)[0]
      : null;
  return { config, vault, epoch, claimStatus };
}

/** Initialize config + vault PDAs for a mint (call once). */
export function buildInitMintIx(params: {
  programId: PublicKey;
  mint: PublicKey;
  payer: PublicKey;
  /** Operator authority stored in config; must sign upsert_epoch. */
  authority: PublicKey;
}): TransactionInstruction {
  const { config, vault } = deriveDistributorPdas({ programId: params.programId, mint: params.mint });
  const data = Buffer.concat([discriminator("init_mint"), params.mint.toBuffer(), params.authority.toBuffer()]);
  return new TransactionInstruction({
    programId: params.programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Fund the vault PDA (anyone can send SOL). */
export function buildFundVaultIx(params: {
  programId: PublicKey;
  mint: PublicKey;
  funder: PublicKey;
  lamports: bigint;
}): TransactionInstruction {
  const { config, vault } = deriveDistributorPdas({ programId: params.programId, mint: params.mint });
  const data = Buffer.concat([discriminator("fund_vault"), u64LE(params.lamports)]);
  return new TransactionInstruction({
    programId: params.programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: params.funder, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Publish a Merkle root for an epoch (authority only). */
export function buildUpsertEpochIx(params: {
  programId: PublicKey;
  mint: PublicKey;
  authority: PublicKey;
  payer: PublicKey;
  epochId: number;
  merkleRoot: Buffer; // 32 bytes
  totalLamports: number;
}): TransactionInstruction {
  const { config, epoch } = deriveDistributorPdas({
    programId: params.programId,
    mint: params.mint,
    epochId: BigInt(params.epochId),
  });
  if (!epoch) throw new Error("epoch PDA");
  const data = Buffer.concat([
    discriminator("upsert_epoch"),
    u64LE(BigInt(params.epochId)),
    params.merkleRoot,
    u64LE(BigInt(params.totalLamports)),
  ]);
  return new TransactionInstruction({
    programId: params.programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.authority, isSigner: true, isWritable: false },
      { pubkey: epoch, isSigner: false, isWritable: true },
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function buildClaimIx(params: {
  programId: PublicKey;
  mint: PublicKey;
  epochId: bigint;
  recipient: PublicKey;
  payer: PublicKey;
  amountLamports: bigint;
  proof: Buffer[]; // each 32 bytes
}): TransactionInstruction {
  const pdas = deriveDistributorPdas({
    programId: params.programId,
    mint: params.mint,
    epochId: params.epochId,
    recipient: params.recipient,
  });
  if (!pdas.epoch || !pdas.claimStatus) throw new Error("claim requires epoch and claimStatus PDAs");
  const { config, vault, epoch, claimStatus } = pdas;

  const data = Buffer.concat([
    discriminator("claim"),
    u64LE(params.epochId),
    u64LE(params.amountLamports),
    u32LE(params.proof.length),
    ...params.proof,
  ]);

  return new TransactionInstruction({
    programId: params.programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: epoch, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: claimStatus, isSigner: false, isWritable: true },
      { pubkey: params.recipient, isSigner: false, isWritable: true },
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

