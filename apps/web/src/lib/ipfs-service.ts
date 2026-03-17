/**
 * IPFS / Pinata service for token images and metadata (matches fun-launch pattern).
 * Uses PINATA_JWT or PINATA_API_KEY + PINATA_SECRET_API_KEY from env.
 * When configured, uploads image then metadata JSON to Pinata and returns permanent IPFS gateway URLs.
 */

import axios, { AxiosError } from "axios";
import FormData from "form-data";

const PINATA_BASE = "https://api.pinata.cloud";

export interface TokenMetadata {
  name: string;
  symbol: string;
  description?: string;
  image: string;
  external_url?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  properties?: {
    files?: Array<{ uri: string; type: string }>;
    category?: string;
  };
}

function getAuthHeaders(): Record<string, string> {
  const jwt = process.env.PINATA_JWT?.trim();
  if (jwt) {
    return { Authorization: `Bearer ${jwt}` };
  }
  const key = process.env.PINATA_API_KEY?.trim();
  const secret = process.env.PINATA_SECRET_API_KEY?.trim();
  if (key && secret) {
    return {
      pinata_api_key: key,
      pinata_secret_api_key: secret,
    };
  }
  return {};
}

/** Extract a readable Pinata error message from an axios error. */
function pinataErrorMessage(err: unknown): string {
  const ax = err as AxiosError<{ error?: string; message?: string }>;
  const data = ax.response?.data;
  const status = ax.response?.status;
  if (data && typeof data === "object") {
    const msg = (data as { error?: string; message?: string }).error ?? (data as { message?: string }).message;
    if (msg) return `Pinata (${status ?? "?"}): ${msg}`;
  }
  if (status) return `Pinata HTTP ${status}`;
  return err instanceof Error ? err.message : "Pinata upload failed";
}

export function isPinataConfigured(): boolean {
  const jwt = process.env.PINATA_JWT?.trim();
  if (jwt) return true;
  const key = process.env.PINATA_API_KEY?.trim();
  const secret = process.env.PINATA_SECRET_API_KEY?.trim();
  return !!(key && secret);
}

function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return "image/png";
  }
}

/**
 * Upload image buffer to Pinata; returns gateway URL.
 * Request shape matches fun-launch (formData + pinataMetadata + pinataOptions).
 */
export async function uploadImageToPinata(
  imageBuffer: Buffer,
  filename: string,
  tokenSymbol: string
): Promise<string> {
  const auth = getAuthHeaders();
  if (!auth.Authorization && !auth.pinata_api_key) {
    throw new Error("Pinata not configured: set PINATA_JWT or PINATA_API_KEY + PINATA_SECRET_API_KEY");
  }

  const formData = new FormData();
  formData.append("file", imageBuffer, {
    filename,
    contentType: getContentType(filename),
  });
  formData.append(
    "pinataMetadata",
    JSON.stringify({
      name: `${tokenSymbol}-logo`,
      keyvalues: { tokenSymbol, uploadedAt: new Date().toISOString() },
    })
  );
  formData.append("pinataOptions", JSON.stringify({ cidVersion: 0 }));

  try {
    const headers = auth.Authorization
      ? { ...formData.getHeaders(), Authorization: auth.Authorization }
      : { ...formData.getHeaders(), ...auth };
    const response = await axios.post(`${PINATA_BASE}/pinning/pinFileToIPFS`, formData, {
      headers,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    return `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
  } catch (err) {
    const msg = pinataErrorMessage(err);
    console.error("[ipfs-service] Image upload failed:", msg, (err as AxiosError)?.response?.data);
    throw new Error(msg);
  }
}

/**
 * Upload Metaplex-style metadata JSON to Pinata; returns gateway URL.
 * Payload shape matches fun-launch (pinataContent, pinataMetadata, pinataOptions).
 */
export async function uploadMetadataToPinata(
  metadata: TokenMetadata,
  tokenSymbol: string
): Promise<string> {
  const auth = getAuthHeaders();
  if (!auth.Authorization && !auth.pinata_api_key) {
    throw new Error("Pinata not configured: set PINATA_JWT or PINATA_API_KEY + PINATA_SECRET_API_KEY");
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...auth,
    };
    const response = await axios.post(
      `${PINATA_BASE}/pinning/pinJSONToIPFS`,
      {
        pinataContent: metadata,
        pinataMetadata: {
          name: `${tokenSymbol}-metadata`,
          keyvalues: { tokenSymbol, uploadedAt: new Date().toISOString() },
        },
        pinataOptions: { cidVersion: 0 },
      },
      { headers }
    );
    return `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
  } catch (err) {
    const msg = pinataErrorMessage(err);
    console.error("[ipfs-service] Metadata upload failed:", msg, (err as AxiosError)?.response?.data);
    throw new Error(msg);
  }
}

/**
 * Upload image then metadata to Pinata; returns the metadata URI for the token.
 * If externalUrl is not provided and mint is known, caller can pass token page URL (e.g. APP_URL/t/mint).
 */
export async function createTokenMetadataUri(params: {
  name: string;
  symbol: string;
  description?: string;
  imageBuffer: Buffer;
  imageFilename: string;
  externalUrl?: string;
}): Promise<string> {
  const imageUrl = await uploadImageToPinata(
    params.imageBuffer,
    params.imageFilename,
    params.symbol
  );

  const metadata: TokenMetadata = {
    name: params.name,
    symbol: params.symbol,
    description: params.description || `${params.name} token on Shill It`,
    image: imageUrl,
    attributes: [
      { trait_type: "Platform", value: "Shill It" },
      { trait_type: "Network", value: "Solana" },
    ],
    properties: {
      category: "token",
      files: [{ uri: imageUrl, type: "image" }],
    },
  };
  if (params.externalUrl) metadata.external_url = params.externalUrl;

  return uploadMetadataToPinata(metadata, params.symbol);
}
