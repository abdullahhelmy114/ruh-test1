/**
 * Signing out ends the server session in this browser.
 *
 * The launch E2E audit (2026-09-18) found that "Log out" only signed out of
 * Firebase in the page. The `__session` cookie is httpOnly, so it stayed in
 * the browser and every page and API kept accepting it for up to 14 days —
 * on a shared computer the next person was still signed in. Expiring the
 * cookie alone would still leave any copy of it valid, so signing out also
 * revokes the account's Firebase session.
 *
 * The browser flow is re-run by the audit; these are the static invariants.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
/** Source with comments removed, so a comment that mentions a pattern cannot satisfy or break an assertion. */
const code = (rel: string) => read(rel).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

describe("the session route can expire the session cookie", () => {
  const src = code("src/app/api/auth/session/route.ts");

  test("DELETE expires __session with the attributes it was set with", () => {
    assert.match(src, /export async function DELETE\(request: NextRequest\)/);
    assert.match(src, /response\.cookies\.set\("__session", "", \{ \.\.\.SESSION_COOKIE, maxAge: 0 \}\)/);
    assert.match(src, /response\.cookies\.set\("__session", sessionCookie, \{ \.\.\.SESSION_COOKIE, maxAge: SESSION_MAX_AGE_SECONDS \}\)/);
    assert.match(src, /const SESSION_COOKIE = \{ httpOnly: true, secure: true, sameSite: "lax", path: "\/" \} as const;/);
  });

  test("a copied cookie dies too: the caller's own verified session is revoked", () => {
    const handler = src.slice(src.indexOf("export async function DELETE"));
    const verify = handler.indexOf("auth.verifySessionCookie(cookie, true)");
    const revoke = handler.indexOf("auth.revokeRefreshTokens(decoded.uid)");
    assert.ok(verify >= 0, "the uid comes from the caller's own verified cookie");
    assert.ok(revoke > verify, "revocation uses that verified uid, never a request field");
    assert.doesNotMatch(handler, /request\.json\(\)|searchParams/);
  });

  test("the session check refuses revoked cookies", () => {
    assert.match(code("src/lib/auth/index.ts"), /verifySessionCookie\(cookie, true\)/);
  });
});

describe("the header's Log out ends the server session first", () => {
  const src = code("src/components/Navbar.tsx");
  const handler = src.slice(src.indexOf("const handleLogout"), src.indexOf("const dashboardLink"));

  test("the cookie is expired before Firebase sign-out, then the page reloads", () => {
    const expire = handler.indexOf('fetch("/api/auth/session", { method: "DELETE"');
    const firebase = handler.indexOf("signOut(getAuth())");
    const reload = handler.indexOf('window.location.assign("/")');
    assert.ok(expire >= 0, "calls DELETE /api/auth/session");
    assert.ok(firebase > expire, "signs out of Firebase after the cookie is gone");
    assert.ok(reload > firebase, "reloads so server-rendered pages drop the account");
  });
});
