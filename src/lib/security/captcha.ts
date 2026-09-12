/**
 * Server-side reCAPTCHA verification (Phase 3 batch 3).
 *
 * Wraps the project's existing Google reCAPTCHA integration
 * (RECAPTCHA_SECRET_KEY, https://www.google.com/recaptcha/api/siteverify):
 *   - fails closed when the secret is not configured
 *   - fails closed on provider/network failure, timeout or malformed reply
 *   - rejects malformed tokens before contacting the provider
 *   - sends the secret in the POST body, never in a URL
 *   - never includes the secret or the provider response in the result
 *
 * `fetchImpl` and `timeoutMs` are injectable for tests.
 */

export type CaptchaReason = "ok" | "unconfigured" | "invalid-token" | "rejected" | "provider-error";

export interface CaptchaResult {
  ok: boolean;
  reason: CaptchaReason;
}

export const CAPTCHA_TIMEOUT_MS = 5_000;
const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
// Real reCAPTCHA v2/v3 response tokens are long URL-safe base64 strings
// (commonly 500 to 2000+ chars); the bound only rejects garbage and
// oversized payloads, never a token the provider can issue.
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{20,4096}$/;

export interface CaptchaDeps {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Optional client key forwarded as `remoteip`; must already be a bare IP. */
  remoteIp?: string;
}

export function isPlausibleCaptchaToken(token: unknown): token is string {
  return typeof token === "string" && TOKEN_SHAPE.test(token);
}

export async function verifyRecaptcha(
  token: unknown,
  secret: string | undefined,
  deps: CaptchaDeps = {}
): Promise<CaptchaResult> {
  if (!secret) return { ok: false, reason: "unconfigured" };
  if (!isPlausibleCaptchaToken(token)) return { ok: false, reason: "invalid-token" };

  const fetchImpl = deps.fetchImpl ?? fetch;
  const timeoutMs = deps.timeoutMs ?? CAPTCHA_TIMEOUT_MS;

  const body = new URLSearchParams({ secret, response: token });
  if (deps.remoteIp) body.set("remoteip", deps.remoteIp);

  try {
    const res = await fetchImpl(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, reason: "provider-error" };
    const data: unknown = await res.json().catch(() => null);
    const success = !!data && typeof data === "object" && (data as { success?: unknown }).success === true;
    return success ? { ok: true, reason: "ok" } : { ok: false, reason: "rejected" };
  } catch {
    // Timeout, network failure or abort: never treat as verified.
    return { ok: false, reason: "provider-error" };
  }
}
