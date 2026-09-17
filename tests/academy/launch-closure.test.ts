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
  test("no page, layout or route handler reads Next 16 params synchronously", () => {
    const SYNC_PARAMS = /params:\s*\{\s*\w+\s*:\s*string/;
    // The pattern catches the legacy signatures and not the Promise form.
    assert.match("{ params }: { params: { id: string } }", SYNC_PARAMS);
    assert.doesNotMatch("ctx: { params: Promise<{ id: string }> }", SYNC_PARAMS);
    const scanned = walk(join(ROOT, "src", "app")).filter((path) => /(page|layout)\.tsx$|route\.ts$/.test(path));
    const dynamic = scanned.filter((path) => rel(path).includes("["));
    assert.ok(dynamic.length >= 100, `only ${dynamic.length} dynamic segment files scanned; the check would be vacuous`);
    const offenders = scanned.filter((path) => SYNC_PARAMS.test(readFileSync(path, "utf8"))).map(rel);
    assert.deepEqual(offenders, []);
  });

  test("translated JSX is never passed where a string prop is required", () => {
    const tsx = walk(join(ROOT, "src")).filter((path) => path.endsWith(".tsx"));
    const users = tsx.filter((path) => readFileSync(path, "utf8").includes("<T>"));
    assert.ok(users.length >= 20, "the <T> scan would be vacuous");
    const offenders = users
      .filter((path) => /\b(?:placeholder|aria-label|title|alt)=\{<T>|toast\.\w+\(<T>[^<]*\{/.test(readFileSync(path, "utf8")))
      .map(rel);
    assert.deepEqual(offenders, []);
  });

  test("the production build type-checks and uses the Next 16 proxy convention", () => {
    const config = readFileSync(join(ROOT, "next.config.ts"), "utf8");
    assert.match(config, /typescript: \{\s*ignoreBuildErrors: false,\s*\}/);
    assert.doesNotMatch(config, /ignoreBuildErrors: true|ignoreDuringBuilds/);
    const tsconfig = readFileSync(join(ROOT, "tsconfig.json"), "utf8");
    assert.match(tsconfig, /"\*\*\/\*\.ts",\s*"\*\*\/\*\.tsx"/, "the type check covers every TypeScript file");
    assert.match(tsconfig, /"exclude": \["node_modules"\]/, "nothing but dependencies is excluded");
    assert.doesNotMatch(tsconfig, /"(?:skipLibCheck|strict)": false|"noImplicitAny": false/);
    assert.equal(statSync(join(ROOT, "src", "proxy.ts")).isFile(), true);
    assert.throws(() => statSync(join(ROOT, "src", "middleware.ts")), "the deprecated middleware file is gone");
    assert.match(readFileSync(join(ROOT, "src", "proxy.ts"), "utf8"), /export function proxy\(request: NextRequest\)/);
  });

  test("academy public pages use theme tokens so dark mode works", () => {
    for (const path of walk(join(ROOT, "src", "app", "academy"))) {
      const src = readFileSync(path, "utf8");
      assert.doesNotMatch(src, /\b(?:bg|text|border)-(?:white|black|(?:gray|slate|zinc|neutral|stone|red|green|blue|yellow|emerald|amber)-\d{2,3})\b/, rel(path));
    }
  });
});
