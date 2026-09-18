/**
 * Two public surfaces that told visitors something the product does not do.
 *
 * The launch E2E audit (2026-09-18) found:
 *   - /certification "verified" any certificate code: the button set the
 *     result to valid after a 1.5 s timer and never asked the server. The
 *     academy already has a real verifier (valid / revoked / not found) at
 *     /academy/certificates/verify; the form now sends the code there.
 *   - The purchase modal on /subscriptions and on course pages asked for a
 *     bank transfer to a hard-coded IBAN plus a receipt over WhatsApp, and
 *     promised immediate activation. Whop is the only payment channel and its
 *     checkout is not open, so the modal now says no payment is taken yet.
 *
 * The browser flow is re-run by the audit; these are the static invariants
 * that keep either fake from coming back with a small edit.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
/** Source with comments removed, so a comment that mentions a pattern cannot satisfy or break an assertion. */
const code = (rel: string) => read(rel).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const CERTIFICATION = "src/app/certification/CertificationContent.tsx";
const PAYMENT_MODAL = "src/components/PaymentModal.tsx";
const LOCALES = ["en", "ar", "tr"] as const;

describe("/certification verifies codes with the academy's verifier", () => {
  const src = code(CERTIFICATION);

  test("the form submits the code to the real verification page", () => {
    assert.match(src, /const CERTIFICATE_VERIFY_PATH = "\/academy\/certificates\/verify";/);
    assert.match(src, /<form action=\{CERTIFICATE_VERIFY_PATH\} method="get"/);
    assert.match(src, /name="code"/);
  });

  test("no result is decided in the browser", () => {
    assert.doesNotMatch(src, /setTimeout/);
    assert.doesNotMatch(src, /Certificate Valid|Certificate Invalid/);
    assert.doesNotMatch(src, /useState/);
  });

  test("the verification page it targets exists", () => {
    assert.match(read("src/app/academy/certificates/verify/page.tsx"), /certificateService\.verify\(code\)/);
  });
});

describe("the purchase modal takes no manual payment", () => {
  const src = code(PAYMENT_MODAL);

  test("no bank account, WhatsApp number or receipt flow", () => {
    assert.doesNotMatch(src, /IBAN|iban/);
    assert.doesNotMatch(src, /wa\.me|WHATSAPP|whatsapp/i);
    assert.doesNotMatch(src, /\bTR\d{2}\b/);
    assert.doesNotMatch(src, /receipt|activated immediately/i);
  });

  test("it says plainly that payment is not open, in every locale", () => {
    assert.match(src, /<T>Online payment is not open yet<\/T>/);
    for (const locale of LOCALES) {
      const messages = JSON.parse(read(`src/messages/${locale}.json`)) as Record<string, unknown>;
      assert.equal(typeof messages["Online payment is not open yet"], "string", locale);
      const body = messages["Courses and subscriptions will be purchased through our secure Whop checkout. Until it opens, no payment is taken and nothing needs to be transferred."];
      assert.equal(typeof body, "string", locale);
      assert.match(String(body), /Whop/, locale);
    }
  });

  test("callers keep the same props", () => {
    for (const caller of ["src/app/subscriptions/page.tsx", "src/components/course/themes/Theme2.tsx", "src/components/student/CourseGrid.tsx"]) {
      assert.match(read(caller), /<PaymentModal[\s\S]*?courseTitle=/, caller);
    }
  });
});
