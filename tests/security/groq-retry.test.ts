/**
 * Phase 3 batch 5 — shared Gemini client retry/timeout/key/error behaviour.
 * Mock fetch + injected sleep: no network, no real waiting.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BASE_BACKOFF_MS,
  DEFAULT_TIMEOUT_MS,
  GROQ_MAX_ATTEMPTS,
  GeminiProviderError,
  MAX_PROVIDER_DELAY_MS,
  groqChatCompletion,
  type ChatMessage,
} from "../../src/lib/groq-client.ts";

const KEY = "unit-test-gemini-key-not-real";
const MESSAGES: ChatMessage[] = [
  { role: "system", content: "sys" },
  { role: "user", content: "hello" },
];
const OK_BODY = JSON.stringify({ candidates: [{ content: { parts: [{ text: "reply" }] } }] });
const SECRET_BODY = '{"error":{"message":"quota exceeded for project 123 key AIza-SECRET","retryDelay":"7s"}}';

interface Call { url: string; init: RequestInit }

function harness(responder: (n: number, url: string, init: RequestInit) => Response | Promise<Response> | never) {
  const calls: Call[] = [];
  const sleeps: number[] = [];
  const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const i = init ?? {};
    calls.push({ url: String(url), init: i });
    return responder(calls.length, String(url), i);
  }) as typeof fetch;
  const sleep = async (ms: number) => { sleeps.push(ms); };
  return { calls, sleeps, deps: { fetchImpl, sleep, apiKey: KEY } };
}

const status = (code: number, body = "{}", headers: Record<string, string> = {}) =>
  new Response(body, { status: code, headers });

describe("attempt accounting", () => {
  test("success -> exactly one request, key in header, never in URL", async () => {
    const h = harness(() => status(200, OK_BODY));
    const res = await groqChatCompletion(MESSAGES, {}, h.deps);
    assert.equal(res.text, "reply");
    assert.equal(h.calls.length, 1);
    assert.equal(h.sleeps.length, 0);
    const headers = h.calls[0].init.headers as Record<string, string>;
    assert.equal(headers["x-goog-api-key"], KEY);
    assert.equal(h.calls[0].url.includes("key="), false);
    assert.equal(h.calls[0].url.includes(KEY), false);
    assert.ok(h.calls[0].url.startsWith("https://generativelanguage.googleapis.com/v1beta/models/"));
    assert.ok(h.calls[0].init.signal instanceof AbortSignal, "every attempt carries an abort signal");
  });

  for (const code of [400, 401, 403, 404]) {
    test(`${code} -> one request, no retry, no sleep`, async () => {
      const h = harness(() => status(code, SECRET_BODY));
      await assert.rejects(() => groqChatCompletion(MESSAGES, {}, h.deps), (e: unknown) => {
        assert.ok(e instanceof GeminiProviderError);
        assert.equal(e.status, code);
        assert.equal(e.retryable, false);
        return true;
      });
      assert.equal(h.calls.length, 1);
      assert.equal(h.sleeps.length, 0);
    });
  }

  test("429 -> retries up to GROQ_MAX_ATTEMPTS total calls (three total, not first + three)", async () => {
    const h = harness(() => status(429, "{}"));
    await assert.rejects(() => groqChatCompletion(MESSAGES, {}, h.deps), GeminiProviderError);
    assert.equal(GROQ_MAX_ATTEMPTS, 3);
    assert.equal(h.calls.length, 3);
    assert.equal(h.sleeps.length, 2, "sleeps only between attempts");
  });

  test("500/503 -> three total calls", async () => {
    const h = harness((n) => status(n === 2 ? 503 : 500));
    await assert.rejects(() => groqChatCompletion(MESSAGES, {}, h.deps), GeminiProviderError);
    assert.equal(h.calls.length, 3);
  });

  test("recovers when a later attempt succeeds", async () => {
    const h = harness((n) => (n < 3 ? status(500) : status(200, OK_BODY)));
    const res = await groqChatCompletion(MESSAGES, {}, h.deps);
    assert.equal(res.text, "reply");
    assert.equal(h.calls.length, 3);
  });

  test("network failure -> three total calls, sanitized error", async () => {
    const h = harness(() => { throw new TypeError("fetch failed: ECONNRESET to 10.0.0.1"); });
    await assert.rejects(() => groqChatCompletion(MESSAGES, {}, h.deps), (e: unknown) => {
      assert.ok(e instanceof GeminiProviderError);
      assert.equal(e.message.includes("ECONNRESET"), false);
      assert.equal(e.message.includes("10.0.0.1"), false);
      return true;
    });
    assert.equal(h.calls.length, 3);
  });

  test("timeout (AbortError/TimeoutError) -> three total calls", async () => {
    const h = harness(() => { throw new DOMException("The operation was aborted due to timeout", "TimeoutError"); });
    await assert.rejects(() => groqChatCompletion(MESSAGES, {}, h.deps), GeminiProviderError);
    assert.equal(h.calls.length, 3);
  });
});

describe("backoff and provider delay", () => {
  test("fallback backoff is 2 s then 4 s", async () => {
    const h = harness(() => status(500));
    await assert.rejects(() => groqChatCompletion(MESSAGES, {}, h.deps));
    assert.deepEqual(h.sleeps, [BASE_BACKOFF_MS, BASE_BACKOFF_MS * 2]);
    assert.equal(BASE_BACKOFF_MS, 2000);
  });

  test("429 retryDelay in the body is honoured (+0.5 s)", async () => {
    const h = harness(() => status(429, '{"error":{"details":[{"retryDelay":"7s"}]}}'));
    await assert.rejects(() => groqChatCompletion(MESSAGES, {}, h.deps));
    assert.deepEqual(h.sleeps, [7500, 7500]);
  });

  test("Retry-After header is honoured", async () => {
    const h = harness(() => status(429, "{}", { "retry-after": "3" }));
    await assert.rejects(() => groqChatCompletion(MESSAGES, {}, h.deps));
    assert.deepEqual(h.sleeps, [3500, 3500]);
  });

  test("provider delay is capped at MAX_PROVIDER_DELAY_MS", async () => {
    const h = harness(() => status(429, '{"retryDelay":"600s"}'));
    await assert.rejects(() => groqChatCompletion(MESSAGES, {}, h.deps));
    assert.equal(MAX_PROVIDER_DELAY_MS, 20_000);
    for (const s of h.sleeps) assert.ok(s <= MAX_PROVIDER_DELAY_MS, `sleep ${s} exceeds cap`);
  });

  test("no sleep exceeds the cap under any responder", async () => {
    const h = harness(() => status(503, "{}", { "retry-after": "9999" }));
    await assert.rejects(() => groqChatCompletion(MESSAGES, {}, h.deps));
    assert.ok(h.sleeps.every((s) => s <= MAX_PROVIDER_DELAY_MS));
  });
});

describe("error safety and timeout wiring", () => {
  test("thrown error never contains the provider body", async () => {
    const h = harness(() => status(429, SECRET_BODY));
    await assert.rejects(() => groqChatCompletion(MESSAGES, {}, h.deps), (e: unknown) => {
      const msg = String((e as Error).message);
      assert.equal(msg.includes("quota exceeded"), false);
      assert.equal(msg.includes("AIza"), false);
      assert.equal(msg.includes("project 123"), false);
      assert.match(msg, /^Gemini provider status 429$/);
      return true;
    });
  });

  test("per-attempt timeout defaults to 120 s and is overridable per call", () => {
    assert.equal(DEFAULT_TIMEOUT_MS, 120_000);
    const src = readFileSync(join(import.meta.dirname, "..", "..", "src", "lib", "groq-client.ts"), "utf8")
      .replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(src.includes("signal: AbortSignal.timeout(timeoutMs)"), "real fetch abort per attempt");
    assert.ok(src.includes("options.timeoutMs ?? DEFAULT_TIMEOUT_MS"));
    assert.equal(src.includes("?key="), false, "API key must not be in the URL");
    assert.ok(src.includes('"x-goog-api-key": apiKey'));
    assert.equal(src.includes("maxAttempts = 10"), false);
    // Logging the LENGTH of an unparsable model reply is allowed; logging its content is not.
    assert.equal(/console\.(error|warn)\([^)]*(bodyText|errorText|result\.text(?!\.length))/.test(src), false, "provider/model bodies are not logged");
  });
});
