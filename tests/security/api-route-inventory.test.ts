/**
 * Inventory of the access boundary of every API route.
 *
 * Every route handler file either establishes the caller's identity through
 * the central auth layer, answers 410 as a removed endpoint, or is listed in
 * public-api-routes.ts as deliberately reachable without an account, with
 * the reason and the control that replaces sign-in. A new route that does none of these
 * fails here, so nothing becomes public by accident; a listed route that
 * starts authenticating must be removed from the list, so the list stays
 * true. Separately, outside the administrator API, no route returns raw
 * exception text.
 *
 * The same boundary is exercised through a running build by
 * tests/e2e/http-smoke.e2e.ts (anonymous and forged-identity sweep).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { PUBLIC_API_ROUTES as PUBLIC, PUBLIC_HANDLERS } from "./public-api-routes.ts";

const API = join(import.meta.dirname, "..", "..", "src", "app", "api");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ROUTES = walk(API)
  .filter((path) => path.endsWith("route.ts"))
  .map((path) => ({ rel: relative(API, path).replace(/\\/g, "/"), code: stripComments(readFileSync(path, "utf8")) }))
  .sort((a, b) => a.rel.localeCompare(b.rel));

/** Identity established by the central auth layer (or its compatibility shim, which delegates to it). */
const CENTRAL_AUTH = /\b(?:requireAuth|requireAdmin|requireTeacher|requireStudent|requireRole|requireSelfOrAdmin|getServerSession|getSession|verifyIdToken)\(/;
const REMOVED = /This endpoint has been removed\./;

describe("API route access inventory", () => {
  test("the inventory sees the whole API", () => {
    assert.ok(ROUTES.length >= 250, `only ${ROUTES.length} route files found`);
  });

  test("every route authenticates centrally, is a removed endpoint, or is deliberately public", () => {
    const unexplained = ROUTES.filter((r) => !CENTRAL_AUTH.test(r.code) && !REMOVED.test(r.code) && !(r.rel in PUBLIC)).map((r) => r.rel);
    assert.deepEqual(unexplained, []);
  });

  test("the public list names only existing routes that really are unauthenticated", () => {
    const byRel = new Map(ROUTES.map((r) => [r.rel, r.code]));
    for (const [rel, entry] of Object.entries(PUBLIC)) {
      const code = byRel.get(rel);
      assert.ok(code !== undefined, `${rel} no longer exists`);
      assert.doesNotMatch(code, CENTRAL_AUTH, `${rel} now authenticates; remove it from the public list`);
      assert.ok(entry.reason.length > 0);
      if (entry.control) assert.match(code, entry.control, `${rel}: ${entry.reason} needs its control`);
    }
  });

  test("public handlers inside authenticated files are real, exported, and their files still authenticate", () => {
    const byRel = new Map(ROUTES.map((r) => [r.rel, r.code]));
    for (const [rel, entry] of Object.entries(PUBLIC_HANDLERS)) {
      const code = byRel.get(rel);
      assert.ok(code !== undefined, `${rel} no longer exists`);
      assert.ok(!(rel in PUBLIC), `${rel} is listed twice`);
      assert.match(code, CENTRAL_AUTH, `${rel} no longer authenticates; list the whole file as public instead`);
      for (const method of entry.methods) {
        assert.match(code, new RegExp(`export (?:const ${method}\\b|(?:async )?function ${method}\\b)`), `${rel} does not export ${method}`);
      }
      assert.ok(entry.reason.length > 0);
    }
  });

  test("administrator and teacher API paths are never public", () => {
    const leaked = Object.keys(PUBLIC).filter((rel) => rel.startsWith("admin/") || (rel.startsWith("teacher/") && !/^teacher\/(public|rating)\//.test(rel)));
    assert.deepEqual(leaked, []);
    for (const route of ROUTES.filter((r) => r.rel.startsWith("admin/"))) {
      assert.match(route.code, /\b(?:requireAdmin|verifyIdToken|getServerSession)\(/, `${route.rel} must require an administrator`);
    }
  });

  test("outside the administrator API, no route returns raw exception text", () => {
    const leaking = ROUTES.filter((r) => !r.rel.startsWith("admin/"))
      .filter((r) => /(?:error|message|details)\s*:\s*(?:error|err|e)\.message/.test(r.code))
      .map((r) => r.rel);
    assert.deepEqual(leaking, []);
  });

  test("the formerly open administrator page read and teacher earnings now require the right role", () => {
    const pages = ROUTES.find((r) => r.rel === "admin/pages/[slug]/route.ts")?.code ?? "";
    assert.match(pages, /export const GET = withApi<\{ slug: string \}>\(async \(req, ctx\) => \{\s*await requireAdmin\(req\);\s*const \{ slug \} = await ctx\.params;/);
    assert.doesNotMatch(pages, /runtime\s*=\s*['"]edge['"]|error\.message/);
    const earnings = ROUTES.find((r) => r.rel === "teacher/earnings/route.ts")?.code ?? "";
    assert.match(earnings, /const user = await requireTeacher\(req\);/);
    assert.match(earnings, /WHERE te\.teacher_uid = \$\{user\.uid\}/);
    assert.doesNotMatch(earnings, /current-teacher-id|te\.\*/);
  });

  test("teacher applicants have no public profile and teacher routes use no private role checks", () => {
    const publicProfile = ROUTES.find((r) => r.rel === "teacher/public/[uid]/route.ts")?.code ?? "";
    assert.match(publicProfile, /WHERE firebase_uid = \$\{teacherUid\} AND role = 'teacher' AND status = 'active'/);
    // Every teacher API route that checks the role does so through the central layer (which knows about applicants).
    for (const route of ROUTES.filter((r) => r.rel.startsWith("teacher/"))) {
      assert.doesNotMatch(route.code, /verifyIdToken\(token\)|firebaseAdmin|role = 'teacher'\s*\n?\s*LIMIT/, route.rel);
    }
  });

  test("the waitlist form is limited, changes no schema and does not reveal who is already listed", () => {
    const waitlist = ROUTES.find((r) => r.rel === "waitlist/route.ts")?.code ?? "";
    const limitAt = waitlist.indexOf("checkRateLimit(");
    assert.ok(limitAt > 0 && limitAt < waitlist.indexOf("req.json()"), "limit before reading the body");
    assert.match(waitlist, /normalizeEmail\(/);
    assert.doesNotMatch(waitlist, /CREATE TABLE|ALTER TABLE|DROP /i);
    assert.match(waitlist, /ON CONFLICT \(email\) DO NOTHING/);
    assert.doesNotMatch(waitlist, /already on the waitlist/i);
  });
});
