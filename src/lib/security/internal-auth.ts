/**
 * Server-to-server trust primitives (Phase 3, batch 1).
 *
 * These helpers authenticate SYSTEMS, never users. They must not be combined
 * with, or replaced by, user identity headers. The module is dependency-free
 * (node:crypto only) so it is unit-testable like src/lib/auth/core.ts; every
 * function takes the secret as a parameter, and the route wrappers read it
 * from the environment and fail closed when it is not configured.
 *
 *   - Internal calls between our own routes (e.g. the Zoom webhook triggering
 *     the YouTube upload route) carry `x-internal-secret`, compared in
 *     constant time against INTERNAL_API_SECRET.
 *   - Zoom webhooks are verified with Zoom's documented scheme: header
 *     `x-zm-signature` = "v0=" + hex(HMAC-SHA256(secretToken,
 *     "v0:" + x-zm-request-timestamp + ":" + rawBody)), and the
 *     `endpoint.url_validation` challenge answered with
 *     hex(HMAC-SHA256(secretToken, plainToken)).
 */
import crypto from "node:crypto";

export const INTERNAL_SECRET_HEADER = "x-internal-secret";
export const ZOOM_SIGNATURE_HEADER = "x-zm-signature";
export const ZOOM_TIMESTAMP_HEADER = "x-zm-request-timestamp";
export const MAX_WEBHOOK_SKEW_SECONDS = 5 * 60;

/** Constant-time string comparison; false on length mismatch or empty input. */
export function secretsMatch(provided: string | null | undefined, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export type InternalSecretCheck = "ok" | "unconfigured" | "invalid";

/**
 * Checks the internal secret on a request.
 *   "unconfigured" — the server has no secret (callers must fail closed, 503)
 *   "invalid"      — header missing or wrong (401)
 *   "ok"           — constant-time match
 * User identity headers are never consulted.
 */
export function checkInternalSecret(
  req: Request,
  configuredSecret: string | undefined
): InternalSecretCheck {
  if (!configuredSecret) return "unconfigured";
  const provided = req.headers.get(INTERNAL_SECRET_HEADER);
  return secretsMatch(provided, configuredSecret) ? "ok" : "invalid";
}

/** Zoom webhook signature check (see module comment). */
export function verifyZoomSignature(
  secretToken: string,
  timestamp: string | null,
  rawBody: string,
  signatureHeader: string | null,
  nowSeconds: number = Date.now() / 1000
): boolean {
  if (!secretToken || !timestamp || !signatureHeader) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > MAX_WEBHOOK_SKEW_SECONDS) return false;

  const expectedHex = crypto
    .createHmac("sha256", secretToken)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest("hex");
  const provided = signatureHeader.startsWith("v0=") ? signatureHeader.slice(3) : "";
  if (!/^[0-9a-f]+$/i.test(provided) || provided.length !== expectedHex.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expectedHex, "hex"));
}

/** Response token for Zoom's `endpoint.url_validation` challenge. */
export function zoomValidationToken(secretToken: string, plainToken: string): string {
  return crypto.createHmac("sha256", secretToken).update(plainToken).digest("hex");
}

/**
 * Only Zoom cloud-recording download URLs may be fetched by the upload route
 * (server-side fetch of a DB-stored URL; this blocks SSRF to internal hosts).
 */
export function isAllowedRecordingUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return host === "zoom.us" || host.endsWith(".zoom.us");
}
