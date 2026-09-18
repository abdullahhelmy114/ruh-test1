/**
 * Whop — the academy's only payment channel: configuration, webhook signature
 * verification, and the one Whop API call the academy makes (opening a
 * checkout).
 *
 * Environment. Whop's sandbox and production are separate systems with
 * separate keys that look identical. The API base defaults to the SANDBOX;
 * production is used only when WHOP_API_BASE_URL names it exactly. A key
 * from the other environment then fails authentication instead of charging
 * anyone.
 *
 * Webhooks follow the Standard Webhooks scheme Whop documents: HMAC-SHA256 over
 * `${webhook-id}.${webhook-timestamp}.${raw body}`, base64, sent as
 * `v1,<signature>` in `webhook-signature` (several space-separated entries
 * are accepted during secret rotation). The key is the secret exactly as Whop
 * issues it; a `whsec_`-prefixed secret is also tried in its Standard
 * Webhooks form (base64 after the prefix). Requests more than five minutes
 * from now are refused, so a captured delivery cannot be replayed later.
 *
 * Nothing here logs or returns the API key or the webhook secret.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const WHOP_SANDBOX_API = "https://sandbox-api.whop.com/api/v1";
export const WHOP_PRODUCTION_API = "https://api.whop.com/api/v1";
export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export interface WhopConfig {
  readonly apiBase: string;
  readonly environment: "sandbox" | "production";
  /** Absent: the academy cannot open checkouts (clean "not available"). */
  readonly apiKey: string | null;
  /** Absent: webhooks are refused (fail closed). */
  readonly webhookSecret: string | null;
  /** Where Whop sends the buyer back: `${returnBase}/academy/checkout/<id>`. */
  readonly returnBase: string;
}

export function resolveWhopConfig(input: {
  readonly apiBase?: string | null;
  readonly apiKey?: string | null;
  readonly webhookSecret?: string | null;
  readonly siteUrl?: string | null;
}): WhopConfig {
  const base = (input.apiBase ?? "").trim().replace(/\/+$/, "");
  if (base !== "" && base !== WHOP_SANDBOX_API && base !== WHOP_PRODUCTION_API) {
    throw new Error("WHOP_API_BASE_URL must be the Whop sandbox or production API base.");
  }
  const apiBase = base === "" ? WHOP_SANDBOX_API : base;
  let returnBase = "http://localhost:3000";
  if (input.siteUrl) {
    const url = new URL(input.siteUrl);
    if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("The site URL must use https.");
    returnBase = url.origin;
  }
  const key = input.apiKey?.trim() ?? "";
  const secret = input.webhookSecret?.trim() ?? "";
  return Object.freeze({
    apiBase,
    environment: apiBase === WHOP_PRODUCTION_API ? "production" : "sandbox",
    apiKey: key === "" ? null : key,
    webhookSecret: secret === "" ? null : secret,
    returnBase,
  });
}

// ---------------------------------------------------------------------------
// Webhook signatures
// ---------------------------------------------------------------------------

export type SignatureCheck = "valid" | "missing" | "stale" | "invalid";

function signingKeys(secret: string): Buffer[] {
  const keys = [Buffer.from(secret, "utf8")];
  if (secret.startsWith("whsec_")) {
    const decoded = Buffer.from(secret.slice("whsec_".length), "base64");
    if (decoded.length > 0) keys.push(decoded);
  }
  return keys;
}

/** Computes the `v1,<base64>` signature Whop sends (used by tests and by the checker). */
export function signWhopPayload(secret: string, id: string, timestamp: string, rawBody: string): string {
  return `v1,${createHmac("sha256", Buffer.from(secret, "utf8")).update(`${id}.${timestamp}.${rawBody}`).digest("base64")}`;
}

export function verifyWhopSignature(
  secret: string,
  headers: { readonly id: string | null; readonly timestamp: string | null; readonly signature: string | null },
  rawBody: string,
  nowSeconds: number,
): SignatureCheck {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return "missing";
  if (!/^\d{1,12}$/.test(timestamp)) return "invalid";
  if (Math.abs(nowSeconds - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) return "stale";
  const provided = signature
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1,"))
    .map((part) => Buffer.from(part.slice(3), "base64"));
  for (const key of signingKeys(secret)) {
    const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();
    if (provided.some((candidate) => candidate.length === expected.length && timingSafeEqual(candidate, expected))) return "valid";
  }
  return "invalid";
}

// ---------------------------------------------------------------------------
// Checkout configurations
// ---------------------------------------------------------------------------

export interface OpenedCheckout {
  readonly providerCheckoutId: string;
  readonly purchaseUrl: string;
}

export class WhopRequestError extends Error {
  readonly status: number;
  readonly errorType: string | null;

  constructor(status: number, errorType: string | null) {
    super(`Whop request failed (${status}${errorType ? ` ${errorType}` : ""}).`);
    this.name = "WhopRequestError";
    this.status = status;
    this.errorType = errorType;
  }
}

/**
 * Opens a Whop checkout for one plan. The metadata (the academy checkout id,
 * the learner and the offer) is set here on the server and copied by Whop to
 * the payment and membership it creates; the browser never supplies it. The
 * academy checkout id doubles as the idempotency key, so a retried request
 * cannot open two checkouts.
 */
export async function createWhopCheckout(
  config: WhopConfig,
  input: { readonly planId: string; readonly checkoutId: string; readonly learnerUid: string; readonly offerId: string },
  fetchImpl: typeof fetch = fetch,
): Promise<OpenedCheckout> {
  if (!config.apiKey) throw new WhopRequestError(0, "not_configured");
  const response = await fetchImpl(`${config.apiBase}/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Idempotency-Key": input.checkoutId,
    },
    body: JSON.stringify({
      plan_id: input.planId,
      redirect_url: `${config.returnBase}/academy/checkout/${input.checkoutId}`,
      metadata: {
        academy_checkout_id: input.checkoutId,
        academy_learner_uid: input.learnerUid,
        academy_offer_id: input.offerId,
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const error = body && typeof body.error === "object" && body.error !== null ? (body.error as Record<string, unknown>) : null;
    throw new WhopRequestError(response.status, typeof error?.type === "string" ? error.type : null);
  }
  const id = body?.id;
  const url = body?.purchase_url;
  if (typeof id !== "string" || !/^ch_[A-Za-z0-9]{1,64}$/.test(id) || typeof url !== "string" || !/^https:\/\//.test(url) || url.length > 2000) {
    throw new WhopRequestError(response.status, "unexpected_response");
  }
  return { providerCheckoutId: id, purchaseUrl: url };
}
