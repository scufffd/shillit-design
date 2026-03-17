import fs from "fs";
import path from "path";

export type FeeEpochIndexItem = {
  mint: string;
  epochId: number;
  merkleRoot: string; // hex
  totalLamports: number;
  createdAt: string;
};

export type FeeEpochFile = {
  mint: string;
  epochId: number;
  merkleRoot: string; // hex
  totalLamports: number;
  allocations: Array<{ wallet: string; lamports: number }>;
};

function baseDir(): string {
  return process.env.FEE_DISTRIBUTIONS_DIR || path.join(process.cwd(), ".data", "fee_distributions");
}

export function loadEpochIndex(): FeeEpochIndexItem[] {
  const p = path.join(baseDir(), "index.json");
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, "utf8");
  return (JSON.parse(raw) as FeeEpochIndexItem[]) ?? [];
}

export function loadEpochFile(mint: string, epochId: number): FeeEpochFile | null {
  const p = path.join(baseDir(), mint, `${epochId}.json`);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw) as FeeEpochFile;
}

export function getNextEpochId(mint: string): number {
  const index = loadEpochIndex();
  const forMint = index.filter((e) => e.mint === mint).map((e) => e.epochId);
  return forMint.length === 0 ? 1 : Math.max(...forMint) + 1;
}

export function saveEpochFile(data: FeeEpochFile): void {
  const dir = path.join(baseDir(), data.mint);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `${data.epochId}.json`);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

export function appendToEpochIndex(item: FeeEpochIndexItem): void {
  const dir = baseDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, "index.json");
  const index = fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as FeeEpochIndexItem[]) : [];
  index.push(item);
  fs.writeFileSync(p, JSON.stringify(index, null, 2), "utf8");
}

