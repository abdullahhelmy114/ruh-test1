/**
 * Launch closure: cross-cutting consistency checks over the whole academy
 * core, so a later change cannot quietly break an invariant that individual
 * unit tests assume.
 *
 *   - every audited action and every audited entity kind in the code is registered;
 *   - every admin-only guard names a real admin-only action;
 *   - every relationship authorization names a real access action;
 *   - every public service method checks capability availability first;
 *   - no academy code uses spoofable identity or legacy auth helpers;
 *   - no page or layout in the app reads Next 16 params synchronously;
 *   - academy public pages use theme tokens, not hard-coded colours (dark mode).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { isAuditAction } from "../../src/lib/academy/audit/audit.ts";
import { isEntityKind } from "../../src/lib/academy/domain/ids.ts";
import { ADMIN_ONLY_ACTIONS } from "../../src/lib/academy/permissions/permissions.ts";

const ROOT = join(import.meta.dirname, "..", "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const rel = (path: string) => relative(ROOT, path).replace(/\\/g, "/");
const academyFiles = walk(join(ROOT, "src", "lib", "academy")).filter((p) => p.endsWith(".ts"));
const academySources = academyFiles.map((path) => ({ path: rel(path), src: readFileSync(path, "utf8") }));

describe("audit vocabulary is closed", () => {
  test("every action literal used for auditing is registered", () => {
    const unknown: string[] = [];
    let checked = 0;
    for (const { path, src } of academySources) {
      // Audit inputs always name the actor right before the action; access requests do not.
      for (const match of src.matchAll(/\bactor(?:: [a-z.]+)?,\s*action: "([a-z_]+\.[a-z_]+)"/g)) {
        checked++;
        if (!isAuditAction(match[1])) unknown.push(`${path}: ${match[1]}`);
      }
    }
    assert.ok(checked >= 40, `only ${checked} audit literals found; the check would be vacuous`);
    assert.deepEqual(unknown, []);
  });

  test("every entity kind literal in audit objects and relationships is registered", () => {
    const unknown: string[] = [];
    for (const { path, src } of academySources) {
      for (const match of src.matchAll(/\b(?:object|from|to|subject): \{ kind: "([a-z_]+)"/g)) {
        if (!isEntityKind(match[1])) unknown.push(`${path}: ${match[1]}`);
      }
      for (const match of src.matchAll(/(?:versionKind|parentKind): "([a-z_]+)"/g)) {
        if (!isEntityKind(match[1])) unknown.push(`${path}: ${match[1]}`);
      }
    }
    assert.deepEqual(unknown, []);
  });
});

describe("permissions vocabulary is closed", () => {
  const permissionsSource = readFileSync(join(ROOT, "src", "lib", "academy", "permissions", "permissions.ts"), "utf8");
  const accessActions = new Set([...permissionsSource.matchAll(/readonly action: "([a-z_]+\.[a-z_]+)"/g)].map((m) => m[1]));

  test("admin-only guards name real admin-only actions", () => {
    const unknown: string[] = [];
    for (const { path, src } of academySources) {
      for (const match of src.matchAll(/(?:authorizeAdminAction\(\s*user,\s*|guard\(\s*user,\s*)"([a-z_]+\.[a-z_]+)"/g)) {
        if (!(ADMIN_ONLY_ACTIONS as readonly string[]).includes(match[1])) unknown.push(`${path}: ${match[1]}`);
      }
    }
    assert.deepEqual(unknown, []);
  });

  test("relationship authorizations name real access actions", () => {
    assert.ok(accessActions.size >= 10);
    const unknown: string[] = [];
    for (const { path, src } of academySources) {
      for (const match of src.matchAll(/(?:authorize|evaluateAccess)\(\s*user,\s*\{\s*action: "([a-z_]+\.[a-z_]+)"/g)) {
        if (!accessActions.has(match[1])) unknown.push(`${path}: ${match[1]}`);
      }
    }
    assert.deepEqual(unknown, []);
  });
});

describe("service entry points", () => {
  test("every service method checks capability availability (directly or through its guard)", () => {
    const missing: string[] = [];
    const services = academySources.filter(({ path }) => path.startsWith("src/lib/academy/services/") && !/\/(support|policy-lookup)\.ts$/.test(path));
    for (const { path, src } of services) {
      // Local helpers whose first statement is the availability check count as checking it.
      const checkingHelpers = [...src.matchAll(/function (\w+)\([^)]*\)[^{]*\{\s*assertAcademyCoreAvailable\(deps\.flags\);/g)].map((m) => m[1]);
      const returned = src.slice(src.indexOf("return {", src.indexOf("export function create")));
      for (const chunk of returned.split(/\n    async /).slice(1)) {
        const name = chunk.slice(0, chunk.indexOf("("));
        const body = chunk.slice(0, 600);
        const ok = body.includes("assertAcademyCoreAvailable(deps.flags)") || checkingHelpers.some((helper) => new RegExp(`\\b${helper}\\(`).test(body));
        if (!ok) missing.push(`${path}: ${name}`);
      }
    }
    assert.deepEqual(missing, []);
  });

  test("academy code never trusts client identity or legacy auth helpers", () => {
    for (const { path, src } of academySources) {
      assert.doesNotMatch(src, /x-user-id|x-user-role|x-forwarded-for|localStorage|lib\/firebase\/server|firebase-admin/, path);
    }
  });
});

describe("framework and presentation", () => {
  test("no page or layout reads Next 16 params synchronously", () => {
    const offenders = walk(join(ROOT, "src", "app"))
      .filter((path) => /(page|layout)\.tsx$/.test(path))
      .filter((path) => /params:\s*\{\s*\w+\s*:\s*string/.test(readFileSync(path, "utf8")))
      .map(rel);
    assert.deepEqual(offenders, []);
  });

  test("academy public pages use theme tokens so dark mode works", () => {
    for (const path of walk(join(ROOT, "src", "app", "academy"))) {
      const src = readFileSync(path, "utf8");
      assert.doesNotMatch(src, /\b(?:bg|text|border)-(?:white|black|(?:gray|slate|zinc|neutral|stone|red|green|blue|yellow|emerald|amber)-\d{2,3})\b/, rel(path));
    }
  });
});
