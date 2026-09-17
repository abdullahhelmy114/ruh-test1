/**
 * Static guarantees for the public certificate verification route.
 *
 * It is the only academy route without sign-in, so it must stay minimal:
 * rate limited per client network key (an abuse signal only), a single
 * verification call, no identity or authorization derived from headers, no
 * caching, and no account identifiers in what it returns.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { verificationResult, type CertificateRecord } from "../../src/lib/academy/certificates/certificates.ts";

const ROUTE = join(import.meta.dirname, "..", "..", "src", "app", "api", "public", "certificates", "[code]", "route.ts");

describe("public certificate verification route", () => {
  const src = readFileSync(ROUTE, "utf8");

  test("is wrapped, rate limited before any work, and not cached", () => {
    assert.match(src, /export const GET = withApi/);
    assert.equal([...src.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\b/g)].length, 0);
    assert.doesNotMatch(src, /export const (POST|PUT|PATCH|DELETE)/);
    const limitAt = src.indexOf("checkRateLimit(");
    assert.ok(limitAt > 0);
    assert.ok(limitAt < src.indexOf("await ctx.params"), "rate limit comes first");
    assert.ok(limitAt < src.indexOf("certificateService.verify"));
    assert.match(src, /headers: PRIVATE_NO_STORE/);
  });

  test("never authenticates or authorises from request headers and only verifies", () => {
    assert.doesNotMatch(src, /requireAuth|requireAdmin|getSession|x-user-id|x-user-role/);
    assert.doesNotMatch(src, /x-forwarded-for/i, "the network key comes from the shared helper, used only for rate limiting");
    assert.doesNotMatch(src, /@\/lib\/db\/client|@neondatabase/);
    assert.equal([...src.matchAll(/certificateService\.(\w+)/g)].map((m) => m[1]).join(","), "verify");
    assert.doesNotMatch(src, /error\.message|catch\s*\(/);
  });

  test("the verification answer carries no identifiers, reasons or contact details", () => {
    const record: CertificateRecord = {
      id: "ce000000-0000-4000-8000-000000000001", code: "RQ-ABCD-EFGH-JKMN", enrollmentId: "f2000000-0000-4000-8000-000000000001",
      completionId: null, learnerUid: "student-secret-uid", courseId: "c0000000-0000-4000-8000-000000000001", classGroupId: "f0000000-0000-4000-8000-000000000001",
      learnerNameSnapshot: "Amina Yusuf", courseTitleSnapshot: "Nahw 1", issuedAt: "2026-12-20T00:00:00.000Z", issuedBy: "admin-1",
      state: "revoked", revokedAt: "2027-01-05T00:00:00.000Z", revokedBy: "admin-2", revokeReason: "Issued in error to the wrong learner",
    };
    for (const result of [verificationResult(record), verificationResult({ ...record, state: "issued", revokedAt: null, revokedBy: null, revokeReason: null })]) {
      const json = JSON.stringify(result);
      for (const secret of ["student-secret-uid", "admin-1", "admin-2", "wrong learner", record.enrollmentId, record.id]) {
        assert.equal(json.includes(secret), false, secret);
      }
    }
  });
});
