/**
 * Phase 3 batch 1 — server-to-server trust primitives.
 * Pure functions; secrets are passed in, nothing is read from the environment.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  INTERNAL_SECRET_HEADER,
  MAX_WEBHOOK_SKEW_SECONDS,
  checkInternalSecret,
  isAllowedRecordingUrl,
  secretsMatch,
  verifyZoomSignature,
  zoomValidationToken,
} from "../../src/lib/security/internal-auth.ts";

const SECRET = "test-internal-secret-value";

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/lessons/x/upload-youtube", { method: "POST", headers });
}

describe("secretsMatch", () => {
  test("equal strings match; different, empty, or missing values do not", () => {
    assert.equal(secretsMatch(SECRET, SECRET), true);
    assert.equal(secretsMatch(SECRET + "x", SECRET), false);
    assert.equal(secretsMatch(SECRET.slice(1), SECRET), false);
    assert.equal(secretsMatch("", SECRET), false);
    assert.equal(secretsMatch(null, SECRET), false);
    assert.equal(secretsMatch(undefined, SECRET), false);
    assert.equal(secretsMatch(SECRET, ""), false);
  });
});

describe("checkInternalSecret", () => {
  test("reports 'unconfigured' when no secret is set, even if a header is sent (fail closed)", () => {
    assert.equal(checkInternalSecret(req({ [INTERNAL_SECRET_HEADER]: "anything" }), undefined), "unconfigured");
    assert.equal(checkInternalSecret(req({ [INTERNAL_SECRET_HEADER]: "anything" }), ""), "unconfigured");
  });

  test("anonymous request is 'invalid'", () => {
    assert.equal(checkInternalSecret(req(), SECRET), "invalid");
  });

  test("wrong secret is 'invalid'", () => {
    assert.equal(checkInternalSecret(req({ [INTERNAL_SECRET_HEADER]: "wrong" }), SECRET), "invalid");
    assert.equal(checkInternalSecret(req({ [INTERNAL_SECRET_HEADER]: SECRET + "x" }), SECRET), "invalid");
  });

  test("user identity headers never substitute for the internal secret", () => {
    assert.equal(
      checkInternalSecret(
        req({ "x-user-id": "admin", "x-user-role": "admin", authorization: "Bearer fake", cookie: "__session=fake" }),
        SECRET
      ),
      "invalid"
    );
  });

  test("correct secret is 'ok'", () => {
    assert.equal(checkInternalSecret(req({ [INTERNAL_SECRET_HEADER]: SECRET }), SECRET), "ok");
  });
});

describe("verifyZoomSignature", () => {
  const token = "zoom-secret-token";
  const body = JSON.stringify({ event: "recording.completed", payload: { object: { id: "abc" } } });
  const now = 1_800_000_000;
  const ts = String(now);
  const sign = (t: string, b: string, secret = token) =>
    "v0=" + crypto.createHmac("sha256", secret).update(`v0:${t}:${b}`).digest("hex");

  test("valid signature with fresh timestamp passes", () => {
    assert.equal(verifyZoomSignature(token, ts, body, sign(ts, body), now), true);
  });

  test("missing signature, missing timestamp, or missing secret fails", () => {
    assert.equal(verifyZoomSignature(token, ts, body, null, now), false);
    assert.equal(verifyZoomSignature(token, null, body, sign(ts, body), now), false);
    assert.equal(verifyZoomSignature("", ts, body, sign(ts, body), now), false);
  });

  test("tampered body or wrong secret fails", () => {
    assert.equal(verifyZoomSignature(token, ts, body + " ", sign(ts, body), now), false);
    assert.equal(verifyZoomSignature(token, ts, body, sign(ts, body, "other"), now), false);
  });

  test("stale or future timestamp beyond the skew window fails (replay protection)", () => {
    const old = String(now - MAX_WEBHOOK_SKEW_SECONDS - 1);
    assert.equal(verifyZoomSignature(token, old, body, sign(old, body), now), false);
    const future = String(now + MAX_WEBHOOK_SKEW_SECONDS + 1);
    assert.equal(verifyZoomSignature(token, future, body, sign(future, body), now), false);
    const edge = String(now - MAX_WEBHOOK_SKEW_SECONDS);
    assert.equal(verifyZoomSignature(token, edge, body, sign(edge, body), now), true);
  });

  test("malformed signature values fail without throwing", () => {
    assert.equal(verifyZoomSignature(token, ts, body, "v0=", now), false);
    assert.equal(verifyZoomSignature(token, ts, body, "v0=zz", now), false);
    assert.equal(verifyZoomSignature(token, ts, body, "v1=" + "a".repeat(64), now), false);
    assert.equal(verifyZoomSignature(token, "not-a-number", body, sign("not-a-number", body), now), false);
  });

  test("url_validation token is HMAC-SHA256 hex of the plain token", () => {
    const expected = crypto.createHmac("sha256", token).update("plain").digest("hex");
    assert.equal(zoomValidationToken(token, "plain"), expected);
  });
});

describe("isAllowedRecordingUrl", () => {
  test("only https zoom.us download hosts are allowed", () => {
    assert.equal(isAllowedRecordingUrl("https://us02web.zoom.us/rec/download/abc"), true);
    assert.equal(isAllowedRecordingUrl("https://zoom.us/rec/download/abc"), true);
    assert.equal(isAllowedRecordingUrl("http://us02web.zoom.us/rec/download/abc"), false);
    assert.equal(isAllowedRecordingUrl("https://evil.com/zoom.us/x"), false);
    assert.equal(isAllowedRecordingUrl("https://zoom.us.evil.com/x"), false);
    assert.equal(isAllowedRecordingUrl("https://127.0.0.1/admin"), false);
    assert.equal(isAllowedRecordingUrl("https://localhost:3000/api/admin/users"), false);
    assert.equal(isAllowedRecordingUrl("file:///etc/passwd"), false);
    assert.equal(isAllowedRecordingUrl("not a url"), false);
  });
});
