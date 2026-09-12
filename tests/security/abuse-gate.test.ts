/**
 * Phase 3 batch 3 — public abuse gate.
 * Behavioural tests for the captcha helper (mock fetch, no network) and
 * static wiring tests for the five gated routes (comments stripped).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CAPTCHA_TIMEOUT_MS, isPlausibleCaptchaToken, verifyRecaptcha } from "../../src/lib/security/captcha.ts";

const SRC = join(import.meta.dirname, "..", "..", "src");
const code = (rel: string) =>
  readFileSync(join(SRC, rel), "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const SECRET = "test-recaptcha-secret-not-real";
const TOKEN = "03AFcWeA".padEnd(64, "x");

function mockFetch(handler: (url: string, init: RequestInit) => Promise<Response> | Response): { fetchImpl: typeof fetch; calls: Array<{ url: string; init: RequestInit }> } {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return handler(String(url), init ?? {});
  }) as typeof fetch;
  return { fetchImpl, calls };
}

// ---------------------------------------------------------------------------
// Captcha helper
// ---------------------------------------------------------------------------
describe("verifyRecaptcha", () => {
  test("valid provider response verifies; secret goes in the POST body, not the URL", async () => {
    const m = mockFetch(() => new Response(JSON.stringify({ success: true }), { status: 200 }));
    const r = await verifyRecaptcha(TOKEN, SECRET, { fetchImpl: m.fetchImpl });
    assert.deepEqual(r, { ok: true, reason: "ok" });
    assert.equal(m.calls.length, 1);
    assert.equal(m.calls[0].url, "https://www.google.com/recaptcha/api/siteverify");
    assert.equal(m.calls[0].url.includes(SECRET), false, "secret must not be in the URL");
    assert.ok(String(m.calls[0].init.body).includes(`secret=${SECRET}`), "secret must be in the form body");
    assert.ok(m.calls[0].init.signal instanceof AbortSignal, "request must carry a timeout signal");
  });

  test("failed provider response is rejected", async () => {
    const m = mockFetch(() => new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }), { status: 200 }));
    assert.deepEqual(await verifyRecaptcha(TOKEN, SECRET, { fetchImpl: m.fetchImpl }), { ok: false, reason: "rejected" });
  });

  test("missing secret fails closed without calling the provider", async () => {
    const m = mockFetch(() => new Response("{}", { status: 200 }));
    assert.deepEqual(await verifyRecaptcha(TOKEN, undefined, { fetchImpl: m.fetchImpl }), { ok: false, reason: "unconfigured" });
    assert.deepEqual(await verifyRecaptcha(TOKEN, "", { fetchImpl: m.fetchImpl }), { ok: false, reason: "unconfigured" });
    assert.equal(m.calls.length, 0);
  });

  test("missing or malformed token fails closed without calling the provider", async () => {
    const m = mockFetch(() => new Response("{}", { status: 200 }));
    for (const bad of [undefined, null, "", "short", 5, {}, "has spaces ".repeat(5), "x".repeat(5000), "<script>".padEnd(40, "a")]) {
      assert.deepEqual(await verifyRecaptcha(bad, SECRET, { fetchImpl: m.fetchImpl }), { ok: false, reason: "invalid-token" });
    }
    assert.equal(m.calls.length, 0);
    assert.equal(isPlausibleCaptchaToken(TOKEN), true);
    // Real reCAPTCHA v2/v3 tokens are long URL-safe base64 strings; those must pass the shape check.
    assert.equal(isPlausibleCaptchaToken("03AFcWeA" + "a-Z_9".repeat(300)), true);
    assert.equal(isPlausibleCaptchaToken("custom-captcha-123-verified"), true, "shape alone is not proof; the provider decides");
  });

  test("network error, timeout, non-2xx and malformed provider bodies all fail closed", async () => {
    const netErr = mockFetch(() => { throw new TypeError("fetch failed"); });
    assert.deepEqual(await verifyRecaptcha(TOKEN, SECRET, { fetchImpl: netErr.fetchImpl }), { ok: false, reason: "provider-error" });

    const timeout = mockFetch(() => { const e = new Error("aborted"); e.name = "TimeoutError"; throw e; });
    assert.deepEqual(await verifyRecaptcha(TOKEN, SECRET, { fetchImpl: timeout.fetchImpl, timeoutMs: 1 }), { ok: false, reason: "provider-error" });

    const http500 = mockFetch(() => new Response("oops", { status: 500 }));
    assert.deepEqual(await verifyRecaptcha(TOKEN, SECRET, { fetchImpl: http500.fetchImpl }), { ok: false, reason: "provider-error" });

    const notJson = mockFetch(() => new Response("<html>", { status: 200 }));
    assert.deepEqual(await verifyRecaptcha(TOKEN, SECRET, { fetchImpl: notJson.fetchImpl }), { ok: false, reason: "rejected" });

    const wrongShape = mockFetch(() => new Response(JSON.stringify({ success: "true" }), { status: 200 }));
    assert.deepEqual(await verifyRecaptcha(TOKEN, SECRET, { fetchImpl: wrongShape.fetchImpl }), { ok: false, reason: "rejected" });
  });

  test("result objects never carry the secret or provider payload", async () => {
    const m = mockFetch(() => new Response(JSON.stringify({ success: false, secretEcho: SECRET }), { status: 200 }));
    const r = await verifyRecaptcha(TOKEN, SECRET, { fetchImpl: m.fetchImpl });
    assert.equal(JSON.stringify(r).includes(SECRET), false);
    assert.deepEqual(Object.keys(r).sort(), ["ok", "reason"]);
    assert.ok(CAPTCHA_TIMEOUT_MS <= 10_000);
  });
});

// ---------------------------------------------------------------------------
// Route wiring (static, executable code only)
// ---------------------------------------------------------------------------
describe("POST /api/signup gate", () => {
  const src = code("app/api/signup/route.ts");
  test("captcha is mandatory and verified; limiter applied; name escaped; no error.message", () => {
    assert.equal(src.includes("if (captchaToken)"), false, "optional captcha branch must be gone");
    assert.ok(src.includes("await verifyRecaptcha(captchaToken, process.env.RECAPTCHA_SECRET_KEY)"));
    assert.ok(src.includes("if (!captcha.ok)"));
    assert.ok(src.indexOf("await verifyRecaptcha(") < src.indexOf("await sendEmail("), "verify before send");
    assert.ok(src.includes("checkRateLimit(`signup:${ip}`"));
    assert.ok(src.includes("checkRateLimit(`signup:email:${email}`"));
    assert.ok(src.includes("${escapeHtml(name)}"), "name must be escaped in the inline template");
    assert.equal(/\$\{name\}/.test(src), false, "raw name must not be interpolated");
    assert.equal(src.includes("siteverify"), false, "inline provider call replaced by the helper");
    assert.equal(src.includes("error.message"), false);
    assert.ok(src.includes("status: 429"));
  });
});

describe("POST /api/contact gate", () => {
  const src = code("app/api/contact/route.ts");
  test("captcha verified server-side before send; limiter and caps applied; template escaping NOT claimed", () => {
    assert.ok(src.includes("await verifyRecaptcha(captchaToken, process.env.RECAPTCHA_SECRET_KEY)"));
    assert.ok(src.includes("if (!captcha.ok)"));
    assert.ok(src.indexOf("await verifyRecaptcha(") < src.indexOf("await sendEmail("), "verify before send");
    assert.equal(src.includes("custom-captcha"), false, "no client puzzle token may be treated as verified");
    assert.ok(src.includes("checkRateLimit(`contact:${clientKey(request)}`"));
    assert.ok(src.includes("name.length > NAME_MAX"));
    assert.ok(src.includes("message.length > MESSAGE_MAX"));
    assert.ok(src.includes("normalizeEmail(rawEmail)"));
    assert.ok(src.includes("status: 429"));
    assert.equal(src.includes("error.message"), false);
    // Honest boundary: the route still calls the untouched template helper.
    assert.ok(src.includes("contactFormEmail(name, email, message)"));
    assert.equal(src.includes("escapeHtml"), false, "escaping lives in src/lib/email.ts, which this batch does not touch");
  });

  test("contact form obtains a real reCAPTCHA token, not the client-side puzzle", () => {
    const page = code("app/contact/ContactContent.tsx");
    assert.ok(page.includes('from "react-google-recaptcha"'));
    assert.ok(page.includes("<ReCAPTCHA sitekey={RECAPTCHA_SITE_KEY} onChange={handleCaptchaVerify}"));
    assert.ok(page.includes("process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY"));
    assert.equal(page.includes("CustomCaptcha"), false, "puzzle captcha must not be used on the contact form");
    assert.ok(page.includes("captchaToken: token"));
  });
});

describe("POST /api/send-verification-code gate", () => {
  const src = code("app/api/send-verification-code/route.ts");
  test("IP limiter, email limiter, resend cooldown, CSPRNG, no Math.random, uniform errors", () => {
    assert.ok(src.includes("checkRateLimit(`verify-send:${clientKey(request)}`"));
    assert.ok(src.includes("checkRateLimit(`verify-send:email:${email}`"));
    assert.ok(src.includes("checkRateLimit(`verify-send:cooldown:${email}`"));
    assert.ok(src.includes("RESEND_COOLDOWN"));
    assert.ok(src.includes("randomInt(100000, 1000000)"));
    assert.equal(src.includes("Math.random"), false);
    assert.ok(src.includes("normalizeEmail("));
    assert.equal(src.includes("error.message"), false);
    assert.ok(src.includes("status: 429"));
  });
});

describe("POST /api/tutor gate", () => {
  const src = code("app/api/tutor/route.ts");
  test("anonymous sales path is rate-limited; caps exist; key in header not URL; timeouts", () => {
    assert.ok(src.includes("checkRateLimit(`tutor-sales:${clientKey(req)}`"));
    assert.ok(src.indexOf("if (!user) {") < src.indexOf("checkRateLimit(`tutor-sales"), "limiter applies only to the anonymous path");
    assert.ok(src.includes("message.length > MESSAGE_MAX"));
    assert.ok(src.includes("HISTORY_MAX_ENTRIES") && src.includes("HISTORY_ENTRY_MAX") && src.includes("HISTORY_TOTAL_MAX"));
    assert.ok(src.includes("boundedHistory(history)"));
    assert.equal(src.includes("?key="), false, "Gemini key must not be in the URL");
    assert.equal(src.includes("${apiKey}`"), false, "Gemini key must not be interpolated into a URL");
    assert.equal((src.match(/'x-goog-api-key': apiKey/g) ?? []).length, 2, "both Gemini calls use the header");
    assert.equal((src.match(/AbortSignal\.timeout\(PROVIDER_TIMEOUT_MS\)/g) ?? []).length, 2, "both Gemini calls time out");
    assert.equal(src.includes("data.error?.message"), false, "provider error text must not be surfaced");
    assert.ok(src.includes("context === 'sales' ? null : await requireAuth(req)"), "auth behaviour for other contexts unchanged");
    assert.equal((src.match(/\.\.\.boundedHistory\(history\)/g) ?? []).length, 1, "history included exactly once");
    assert.equal(src.includes("history.map("), false, "old unbounded history mapping must be gone");
    assert.equal((src.match(/\{ role: 'user', parts: \[\{ text: message \}\] \}/g) ?? []).length, 1, "current message included exactly once");
    assert.equal((src.match(/await fetch\(GEMINI_URL/g) ?? []).length, 2, "exactly two Gemini calls (reply + assessment)");
    assert.equal(src.includes("console.error('Gemini API error:', data)"), false, "provider body must not be logged");
  });
});

describe("POST /api/ai/chat gate", () => {
  const src = code("app/api/ai/chat/route.ts");
  test("limiter, message/history caps, timeout, generic provider errors", () => {
    assert.ok(src.includes("checkRateLimit(`ai-chat:${clientKey(req)}`"));
    assert.ok(src.includes("message.length > MESSAGE_MAX"));
    assert.ok(src.includes("rawHistory.slice(-HISTORY_MAX_ENTRIES)"));
    assert.ok(src.includes("content.slice(0, HISTORY_ENTRY_MAX)"));
    assert.ok(src.includes("historyChars + clipped.length > HISTORY_TOTAL_MAX"));
    assert.ok(src.includes("AbortSignal.timeout(PROVIDER_TIMEOUT_MS)"));
    assert.equal(src.includes("err?.error?.message"), false, "provider error text must not be surfaced");
    assert.equal(src.includes("error.message"), false);
    assert.ok(src.includes("status: 429"));
    assert.ok(src.includes('export const runtime = "nodejs"'), "in-memory limiter requires the Node runtime");
    assert.equal(src.includes('runtime = "edge"'), false);
    assert.equal((src.match(/\.\.\.history,/g) ?? []).length, 1, "history included exactly once");
    assert.equal(src.includes("messages.push("), false, "old push-based message assembly must be gone");
    assert.equal((src.match(/\{ role: "user", content: message \}/g) ?? []).length, 1, "current message included exactly once");
    // The comment stripper truncates string literals at "//", so match the call prefix only.
    assert.equal((src.match(/await fetch\("https:/g) ?? []).length, 1, "exactly one provider call");
    assert.ok(src.includes("AbortSignal.timeout(10_000)"), "academy-info fetch must also be bounded");
    assert.equal(src.includes('console.error("OpenRouter API error:", err)'), false, "provider body must not be logged");
  });
});

describe("batch boundary", () => {
  test("no gated route reads caller identity from the body or query, and none logs a secret", () => {
    for (const rel of ["app/api/signup/route.ts", "app/api/contact/route.ts", "app/api/send-verification-code/route.ts", "app/api/tutor/route.ts", "app/api/ai/chat/route.ts"]) {
      const src = code(rel);
      for (const needle of ["x-user-id", "x-user-role", "body.uid", "body.userId", "searchParams.get('uid')"]) {
        assert.equal(src.includes(needle), false, `${rel} must not contain ${needle}`);
      }
      assert.equal(/console\.(log|error|warn)\([^)]*(SECRET|apiKey|OPENROUTER_API_KEY|captchaToken)/.test(src), false, `${rel} must not log secrets`);
    }
  });
});
