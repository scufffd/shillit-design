/**
 * In-memory temporary store for launch metadata and images.
 * Used by POST /api/launch/metadata-uri and GET /api/launch/metadata/[id], /api/launch/image/[id].
 * Replace with R2/DB for production if needed.
 */

const metadataStore = new Map<string, { name: string; symbol: string; description: string; external_url?: string }>();
const imageStore = new Map<string, Buffer>();

export function getStoredMetadata(id: string) {
  return metadataStore.get(id);
}

export function getStoredImage(id: string) {
  return imageStore.get(id);
}

export function setStored(
  id: string,
  meta: { name: string; symbol: string; description: string; external_url?: string },
  image: Buffer
) {
  metadataStore.set(id, meta);
  imageStore.set(id, image);
}
