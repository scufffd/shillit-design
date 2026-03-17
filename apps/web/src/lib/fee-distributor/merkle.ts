import crypto from "crypto";

const DOMAIN = Buffer.from("shillit:dist:v1", "utf8");

export type Allocation = { wallet: string; lamports: number };

function sha256(data: Buffer): Buffer {
  return crypto.createHash("sha256").update(data).digest();
}

function hashPair(a: Buffer, b: Buffer): Buffer {
  // Must match on-chain ordering: lexicographic compare then hash(a||b)
  const [x, y] = Buffer.compare(a, b) <= 0 ? [a, b] : [b, a];
  return sha256(Buffer.concat([x, y]));
}

export function leafHash(params: { mint: Buffer; epochId: bigint; wallet: Buffer; lamports: bigint }): Buffer {
  const mint = params.mint;
  const wallet = params.wallet;
  const epochBuf = Buffer.alloc(8);
  epochBuf.writeBigUInt64LE(params.epochId);
  const amtBuf = Buffer.alloc(8);
  amtBuf.writeBigUInt64LE(params.lamports);
  return sha256(Buffer.concat([DOMAIN, mint, epochBuf, wallet, amtBuf]));
}

export function buildMerkleTree(leaves: Buffer[]): { root: Buffer; layers: Buffer[][] } {
  if (leaves.length === 0) return { root: Buffer.alloc(32, 0), layers: [leaves] };
  let layer = leaves.slice();
  const layers: Buffer[][] = [layer];
  while (layer.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : layer[i];
      next.push(hashPair(left, right));
    }
    layer = next;
    layers.push(layer);
  }
  return { root: layers[layers.length - 1][0], layers };
}

export function getProof(layers: Buffer[][], leafIndex: number): Buffer[] {
  const proof: Buffer[] = [];
  let idx = leafIndex;
  for (let depth = 0; depth < layers.length - 1; depth++) {
    const layer = layers[depth];
    const pairIdx = idx ^ 1;
    const sibling = layer[pairIdx] ?? layer[idx];
    proof.push(sibling);
    idx = Math.floor(idx / 2);
  }
  return proof;
}

