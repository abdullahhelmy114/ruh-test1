/**
 * The sign-in exchange: a verified Firebase identity is not an account.
 *
 * Profiles are created by the sign-up routes only. Any other way of completing
 * a Firebase sign-in - a Google or Facebook popup, an account made in the
 * Firebase console, a profile that was removed - leaves a verified identity
 * with no profiles row. The exchange used to answer that caller with a
 * fourteen-day session cookie and the invented role "student", while
 * getSession() (src/lib/auth/core.ts) resolves the caller from profiles and
 * returns null without one: the browser looked signed in and every API
 * answered 401.
 *
 * Now the profile decides before any cookie exists. These tests cover each
 * account state the decision must handle, and pin the two places that must
 * honour it: the route (no cookie on refusal) and the login page (no redirect,
 * and the Firebase session ended so the header does not disagree).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decideSession } from "../../src/lib/auth/session-exchange.ts";
import { ADMIN_HOME, LEARNER_HOME, TEACHER_APPLICATION_HOME, TEACHER_WORKSPACE_HOME } from "../../src/lib/auth/home.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const code = (rel: string) => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

describe("what the exchange concludes from the profile row", () => {
  test("an existing student reaches the learner workspace", () => {
    assert.deepEqual(decideSession({ role: "student", status: "active" }), {
      outcome: "established", role: "student", status: "active", home: LEARNER_HOME,
    });
  });

  test("an active teacher reaches teaching; every other teacher state reaches the application page", () => {
    assert.equal(decideSession({ role: "teacher", status: "active" }).outcome, "established");
    assert.equal((decideSession({ role: "teacher", status: "active" }) as { home: string }).home, TEACHER_WORKSPACE_HOME);
    for (const status of ["pending", "changes_requested", "rejected", "withdrawn", "inactive", null, "", "ACTIVE"]) {
      const decision = decideSession({ role: "teacher", status });
      assert.equal(decision.outcome, "established", String(status));
      assert.equal((decision as { home: string }).home, TEACHER_APPLICATION_HOME, String(status));
    }
  });

  test("an approved administrator reaches administration", () => {
    assert.equal((decideSession({ role: "admin", status: "active" }) as { home: string }).home, ADMIN_HOME);
  });

  test("no profile row means no account: no role is invented", () => {
    for (const row of [undefined, null]) {
      assert.deepEqual(decideSession(row), { outcome: "no_account", reason: "no_profile" });
    }
  });

  test("a row that names no role is not promoted, and never becomes an administrator", () => {
    // A missing or unknown role resolves to the least-privileged home; it is never guessed upwards.
    for (const role of [undefined, null, "", 42, "superuser", "ADMIN"]) {
      const decision = decideSession({ role, status: "active" }) as { outcome: string; home: string; role: string | null };
      assert.equal(decision.outcome, "established", String(role));
      assert.equal(decision.home, LEARNER_HOME, String(role));
      assert.notEqual(decision.home, ADMIN_HOME);
      if (typeof role !== "string" || role === "") assert.equal(decision.role, null, String(role));
    }
  });

  test("the decision reports the stored values, inventing nothing", () => {
    const decision = decideSession({ role: "student", status: "pending" }) as { role: string | null; status: string | null };
    assert.equal(decision.role, "student");
    assert.equal(decision.status, "pending");
  });
});

describe("the route honours the decision", () => {
  const route = code("src/app/api/auth/session/route.ts");

  test("the profile is read and judged before any cookie is created", () => {
    const readsProfile = route.indexOf("SELECT role, status FROM profiles");
    const decides = route.indexOf("decideSession(profile)");
    const createsCookie = route.indexOf("createSessionCookie");
    assert.ok(readsProfile !== -1 && decides !== -1 && createsCookie !== -1);
    assert.ok(readsProfile < decides, "the row is read first");
    assert.ok(decides < createsCookie, "nothing is minted before the decision");
  });

  test("a caller with no account gets 401 and no cookie", () => {
    assert.match(route, /if \(decision\.outcome === "no_account"\) \{\s*return NextResponse\.json\(\{ error: "no_account", reason: decision\.reason \}, \{ status: 401 \}\);\s*\}/);
    const refusal = route.slice(route.indexOf('"no_account"'), route.indexOf("createSessionCookie"));
    assert.doesNotMatch(refusal, /cookies\.set/, "the refusal path must not set a cookie");
  });

  test("the role in the response comes from the decision, never a default", () => {
    assert.match(route, /role: decision\.role, status: decision\.status, home: decision\.home/);
    assert.doesNotMatch(route, /\|\| "student"/, "no invented role remains");
  });

  test("neither the token nor the caller's identity is logged", () => {
    assert.doesNotMatch(route, /console\.(log|info|warn|error)/);
  });
});

describe("the login page honours the refusal", () => {
  const login = code("src/app/login/page.tsx");

  test("both sign-in paths go through one exchange that checks the response", () => {
    assert.equal([...login.matchAll(/await completeSession\(idToken\)/g)].length, 2, "email and provider sign-in");
    assert.match(login, /if \(!res\.ok\) \{/);
    assert.equal([...login.matchAll(/redirectAfterLogin\(/g)].length, 1, "one call site, on the ok path only");
  });

  test("a refused exchange ends the Firebase session instead of leaving a half-signed-in browser", () => {
    const refusal = login.slice(login.indexOf("if (!res.ok)"), login.indexOf("redirectAfterLogin(data ?? {})"));
    assert.match(refusal, /await signOut\(auth\)/);
    assert.match(refusal, /setError\(/);
    assert.doesNotMatch(refusal, /window\.location/, "a refusal never navigates to a workspace");
  });

  test("the message tells the visitor what to do and reveals nothing about the account", () => {
    assert.match(login, /const NO_ACCOUNT_MESSAGE = "This sign-in has no academy account yet\. Create an account first\.";/);
    assert.match(login, /data\?\.error === "no_account" \? NO_ACCOUNT_MESSAGE : "Login failed"/);
  });
});
