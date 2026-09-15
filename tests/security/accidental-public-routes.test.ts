/**
 * Containment of the email/auth routes published by accident in commit 78d033b.
 * Behavioural: the three POST stubs have no imports, so they are executed
 * directly and must answer 410 regardless of the request body. Static: the stubs
 * and the pre-existing test-email stub cannot reach email, Firebase or database
 * code, and no app code calls any of the four paths (comments stripped first).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const SRC = join(ROOT, "src");
const API = join(SRC, "app", "api");
const stripComments = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const code = (rel: string) => stripComments(readFileSync(join(API, rel), "utf8"));

const REMOVED_BODY = { error: "This endpoint has been removed." };

const DISABLED_POST_ROUTES = [
  { rel: "auth/reset-password/route.ts", mod: await import("../../src/app/api/auth/reset-password/route.ts") },
  { rel: "auth/welcome-email/route.ts", mod: await import("../../src/app/api/auth/welcome-email/route.ts") },
  { rel: "auth/send-verification-code/route.ts", mod: await import("../../src/app/api/auth/send-verification-code/route.ts") },
];

const REACHABLE_SIDE_EFFECTS = [
  "import ",
  "require(",
  "@/lib/email",
  "sendEmail",
  "nodemailer",
  "firebase",
  "generatePasswordResetLink",
  "@/lib/db",
  "sql`",
  "verification_codes",
  "request.json",
  "error.message",
  "process.env",
];

describe("disabled POST routes from 78d033b", () => {
  for (const { rel, mod } of DISABLED_POST_ROUTES) {
    test(`${rel} exports only POST`, () => {
      assert.deepEqual(Object.keys(mod), ["POST"]);
    });

    test(`${rel} answers 410 with a generic body`, async () => {
      const res = await mod.POST();
      assert.equal(res.status, 410);
      assert.deepEqual(await res.json(), REMOVED_BODY);
    });

    test(`${rel} ignores any caller-supplied recipient or code`, async () => {
      const email = "victim@example.com";
      const req = new Request("http://localhost/api/x", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, firstName: "<b>x</b>", code: "123456" }),
      });
      const res = await (mod.POST as (r: Request) => Promise<Response>)(req);
      assert.equal(res.status, 410);
      const text = await res.text();
      assert.equal(text.includes(email), false, "recipient is never echoed");
      assert.equal(req.bodyUsed, false, "request body is never read");
    });

    test(`${rel} cannot reach email, Firebase or database code`, () => {
      const src = code(rel);
      for (const needle of REACHABLE_SIDE_EFFECTS) {
        assert.equal(src.includes(needle), false, `${rel} must not contain ${needle}`);
      }
    });
  }
});

describe("stale verification route cannot write verification state", () => {
  test("only the real resend route writes verification_codes, by uid with a digest", () => {
    const stale = code("auth/send-verification-code/route.ts");
    assert.equal(/INSERT|UPDATE|DELETE/i.test(stale), false);
    const real = code("send-verification-code/route.ts");
    assert.ok(real.includes("verification_codes"), "real resend route still owns the table");
    assert.ok(real.includes("hashOtp("), "real resend route stores a digest");
  });

  test("the resend button targets the real route, not the stale one", () => {
    const button = stripComments(readFileSync(join(SRC, "components", "ResendVerificationButton.tsx"), "utf8"));
    assert.ok(button.includes('fetch("/api/send-verification-code"'));
    assert.equal(button.includes("/api/auth/send-verification-code"), false);
  });
});

describe("test-email stays disabled", () => {
  const src = code("test-email/route.ts");
  test("GET-only 410 stub with no email code", () => {
    assert.ok(src.includes("status: 410"));
    assert.ok(/export async function GET\(\)/.test(src));
    assert.equal((src.match(/export /g) ?? []).length, 1, "only the GET handler is exported");
    for (const needle of ["@/lib/email", "sendEmail", "nodemailer", "process.env", "request"]) {
      assert.equal(src.includes(needle), false, `test-email must not contain ${needle}`);
    }
  });
});

describe("no app code calls the disabled routes", () => {
  const PATHS = ["/api/auth/reset-password", "/api/auth/welcome-email", "/api/auth/send-verification-code", "/api/test-email"];

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) ? [full] : [];
    });
  }

  test("no file under src references any disabled path", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const src = stripComments(readFileSync(file, "utf8"));
      for (const path of PATHS) {
        if (src.includes(path)) offenders.push(`${relative(ROOT, file).split(sep).join("/")} -> ${path}`);
      }
    }
    assert.deepEqual(offenders, []);
  });
});
