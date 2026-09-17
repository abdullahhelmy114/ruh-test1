/**
 * Server-side Cloudinary upload signing (Phase 3 closure fix F2).
 *
 * SERVER ONLY — handles the API secret. Never import from a client component.
 *
 * The browser names a purpose; this module chooses EVERY signed parameter
 * and signs them following Cloudinary's documented signed-upload protocol,
 * which is exactly what the installed SDK (cloudinary 2.x,
 * `utils.api_sign_request`) implements: sort parameters by key, join
 * `key=value` with `&` (values with `&` escaped as `%26`, signature version
 * 2), append the API secret, hash. SHA-256 is used. The SDK's type
 * definitions only expose the two-argument SHA-1 form of the helper, so the
 * protocol is implemented here with node:crypto; the test-suite verifies the
 * output against the SDK helper configured for SHA-256.
 *
 * WHAT THE CONSTRUCTION DOES AND DOES NOT GUARANTEE.
 * A Cloudinary upload signature is NOT a one-time token: the file is not
 * part of the signed string and the timestamp stays valid for a window.
 * Each authorisation therefore signs, all server-chosen:
 *   - a fresh opaque `public_id` (CSPRNG uuid) with `overwrite=false`, so
 *     a reused signed set cannot store or replace another asset under that
 *     id WITHIN THE SAME Cloudinary resource_type/type namespace;
 *   - a purpose-specific SIGNED `upload_preset` (configured in the console
 *     with the provider-side allowed formats and byte-size ceiling), which
 *     the browser cannot swap because it is inside the signature;
 *   - `allowed_formats`, consistent with the preset.
 * `resource_type` is NOT part of the signed string (per the protocol; it is
 * the endpoint segment), so public-id uniqueness is scoped per resource
 * type and a holder of a valid signed set could try another compatible
 * resource-type endpoint during the validity window. Issuance is bounded by
 * the route's per-client limiter and every such attempt is still subject to
 * the signed preset's provider-side format/size controls. Residual:
 * defence-in-depth limitation, not unbounded storage.
 *
 * `file`, `api_key`, `cloud_name` and `resource_type` are not part of the
 * signed string, per the protocol. The secret is consumed here and never
 * appears in the returned object.
 */
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { UPLOAD_PURPOSES, type UploadPurpose } from "./upload-purpose.ts";

export const SIGNATURE_ALGORITHM = "sha256";
export const SIGNATURE_VERSION = 2;

/** Parameters that are signed; the browser must send them byte-for-byte. */
export type SignedUploadParams = {
  timestamp: number;
  folder: string;
  allowed_formats: string;
  public_id: string;
  overwrite: "false";
  upload_preset: string;
  /** Delivery type: application documents are never publicly deliverable. */
  type: "authenticated";
};

export interface SignedUpload {
  purpose: UploadPurpose;
  resourceType: "raw" | "video";
  params: SignedUploadParams;
  signature: string;
}

/** Test seam only: the id generator. Production always uses randomUUID. */
export interface SignDeps {
  randomId?: () => string;
}

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Preset names are console identifiers: bounded, no whitespace or separators. */
const PRESET_SHAPE = /^[A-Za-z0-9_-]{1,100}$/;

/** Cloudinary string-to-sign (signature version 2). Exported for tests. */
export function cloudinaryStringToSign(params: Record<string, string | number>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`.replace(/&/g, "%26"))
    .join("&");
}

/**
 * Builds and signs the upload parameters for a purpose. The public ID is
 * generated inside this boundary and can never be supplied by a caller;
 * the preset is the SERVER-configured signed preset for that purpose.
 * `now` is injectable for tests; it is otherwise the server clock.
 */
export function signUploadForPurpose(
  purpose: UploadPurpose,
  apiSecret: string,
  uploadPreset: string,
  now: number = Date.now(),
  deps: SignDeps = {}
): SignedUpload {
  if (typeof apiSecret !== "string" || apiSecret.length === 0) {
    throw new Error("Cloudinary API secret is not configured");
  }
  if (typeof uploadPreset !== "string" || !PRESET_SHAPE.test(uploadPreset)) {
    throw new Error("Cloudinary upload preset is not configured");
  }
  const policy = UPLOAD_PURPOSES[purpose];
  const id = (deps.randomId ?? randomUUID)();
  if (!UUID_SHAPE.test(id)) throw new Error("public id generator must return a uuid");

  const params: SignedUploadParams = {
    timestamp: Math.floor(now / 1000),
    folder: policy.folder,
    allowed_formats: policy.allowedFormats,
    public_id: `${id}${policy.publicIdSuffix}`,
    overwrite: "false",
    upload_preset: uploadPreset,
    type: policy.deliveryType,
  };
  const signature = createHash(SIGNATURE_ALGORITHM)
    .update(cloudinaryStringToSign(params) + apiSecret)
    .digest("hex");
  return { purpose, resourceType: policy.resourceType, params, signature };
}

// ---------------------------------------------------------------------------
// Upload references
// ---------------------------------------------------------------------------

/** The storage id Cloudinary gives an upload: the signed folder and the signed public id. */
export function storageIdOf(signed: SignedUpload): string {
  return `${signed.params.folder}/${signed.params.public_id}`;
}

function referenceMessage(purpose: UploadPurpose, storageId: string): string {
  return `upload-reference:v1:${purpose}:${storageId}`;
}

/**
 * Proof that THIS server issued the signature for a storage id, handed to the
 * browser with the signature and required again when an application refers
 * to the upload. An application therefore cannot point at an arbitrary or
 * someone else's asset. HMAC-SHA256 with a server secret (not the Cloudinary
 * secret).
 */
export function uploadReferenceProof(purpose: UploadPurpose, storageId: string, referenceSecret: string): string {
  if (typeof referenceSecret !== "string" || referenceSecret.length === 0) throw new Error("Upload reference secret is not configured");
  return createHmac("sha256", referenceSecret).update(referenceMessage(purpose, storageId)).digest("hex");
}

/** The storage id when its proof is valid for the purpose, otherwise null (constant-time comparison). */
export function verifyUploadReference(purpose: UploadPurpose, reference: unknown, referenceSecret: string): string | null {
  if (!reference || typeof reference !== "object") return null;
  const { storageId, proof } = reference as { storageId?: unknown; proof?: unknown };
  if (typeof storageId !== "string" || typeof proof !== "string" || !/^[0-9a-f]{64}$/.test(proof)) return null;
  const policy = UPLOAD_PURPOSES[purpose];
  if (!storageId.startsWith(`${policy.folder}/`)) return null;
  const expected = Buffer.from(uploadReferenceProof(purpose, storageId, referenceSecret), "hex");
  const given = Buffer.from(proof, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given) ? storageId : null;
}

// ---------------------------------------------------------------------------
// Private download links
// ---------------------------------------------------------------------------

export interface PrivateDownloadConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * A short-lived link to an authenticated asset through Cloudinary's download
 * API (the SDK's `private_download_url`): the timestamp, storage id, delivery
 * type and expiry are signed, so the link cannot be altered or extended.
 */
export function privateDownloadLink(
  config: PrivateDownloadConfig,
  purpose: UploadPurpose,
  storageId: string,
  now: number = Date.now(),
  ttlSeconds = 300,
): { url: string; expiresAt: string } {
  if (!config.cloudName || !config.apiKey || !config.apiSecret) throw new Error("Cloudinary is not configured");
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 3600) throw new Error("ttl out of range");
  const policy = UPLOAD_PURPOSES[purpose];
  if (!storageId.startsWith(`${policy.folder}/`)) throw new Error("storage id does not belong to the purpose");
  const timestamp = Math.floor(now / 1000);
  const expiresAt = timestamp + ttlSeconds;
  const signed = { timestamp, public_id: storageId, type: policy.deliveryType, expires_at: expiresAt };
  const signature = createHash(SIGNATURE_ALGORITHM).update(cloudinaryStringToSign(signed) + config.apiSecret).digest("hex");
  const query = new URLSearchParams({
    timestamp: String(timestamp),
    public_id: storageId,
    type: policy.deliveryType,
    expires_at: String(expiresAt),
    signature,
    api_key: config.apiKey,
  });
  const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${policy.resourceType}/download?${query.toString()}`;
  return { url, expiresAt: new Date(expiresAt * 1000).toISOString() };
}
