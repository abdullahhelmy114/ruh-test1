/**
 * The launch readiness check (scripts/launch-readiness-check.mjs).
 *
 * ACADEMY_CORE_SCHEMA_READY opens every academy service at once, so the gate
 * has to be provable before it is opened: the schema the migrations describe,
 * the account tables, every policy (none has a default), an administrator who
 * can actually administer, the minimum content a cohort needs, and the
 * configuration each flow depends on.
 *
 * These tests keep the script honest: it must stay read-only, it must take the
 * policy list from the registry rather than a copy that can drift, and it must
 * never print a secret or a row of account data.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { POLICY_DEFINITIONS } from "../../src/lib/academy/policies/registry.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const SCRIPT = readFileSync(join(ROOT, "scripts", "launch-readiness-check.mjs"), "utf8");
/** Source with comments removed, so prose cannot satisfy or break an assertion. */
const code = SCRIPT.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

describe("the readiness check only reads", () => {
  test("it contains no statement that could change the database", () => {
    for (const forbidden of [/\bINSERT\b/i, /\bUPDATE\b/i, /\bDELETE\b/i, /\bDROP\b/i, /\bALTER\b/i, /\bTRUNCATE\b/i, /\bCREATE\s+(TABLE|INDEX|EXTENSION)\b/i, /\bGRANT\b/i]) {
      assert.doesNotMatch(code, forbidden, `the check must not contain ${forbidden}`);
    }
    const statements = [...code.matchAll(/sql\.query\(\s*[`"']([^`"']+)/g)].map((m) => m[1].trim());
    assert.ok(statements.length >= 6, `expected several queries, found ${statements.length}`);
    for (const statement of statements) {
      assert.match(statement, /^(SELECT|WITH)\b/i, `every query must be a read: ${statement.slice(0, 50)}`);
    }
  });

  test("it prints no secret, no address and no identifier", () => {
    // Values are reported as set/unset only; the connection string is reduced to its endpoint id.
    assert.doesNotMatch(code, /console\.log\([^)]*process\.env\[[^\]]+\][^)]*\)/, "a variable's value must never be printed");
    assert.doesNotMatch(code, /console\.log\([^)]*DATABASE_URL/);
    assert.match(code, /process\.env\[name\] \? `set/, "configuration is reported as set or unset");
    assert.doesNotMatch(code, /SELECT[^`"']*\b(email|firebase_uid|full_name|email_code|user_uid)\b/i, "no account column is ever selected");
    assert.match(code, /const endpoint = url\.hostname\.split\("\."\)\[0\]/, "the target is named by endpoint id");
  });
});

describe("the readiness check covers the prerequisites the gate depends on", () => {
  test("the academy tables come from the migrations themselves, not a copied list", () => {
    assert.match(code, /readdirSync\(join\(ROOT, "db", "migrations"\)\)/);
    assert.match(code, /create\\s\+table/i);
    const migrationTables = new Set();
    for (const file of readdirSync(join(ROOT, "db", "migrations")).filter((n) => n.endsWith(".up.sql"))) {
      for (const m of readFileSync(join(ROOT, "db", "migrations", file), "utf8").matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(academy_[a-z0-9_]+)/gi)) {
        migrationTables.add(m[1].toLowerCase());
      }
    }
    assert.equal(migrationTables.size, 51, "the academy schema is 51 tables");
  });

  test("the policy list comes from the registry, so a new policy cannot be forgotten", () => {
    assert.match(code, /import \{ POLICY_DEFINITIONS \} from "\.\.\/src\/lib\/academy\/policies\/registry\.ts"/);
    assert.match(code, /Object\.keys\(POLICY_DEFINITIONS\)/);
    // None of them has a default, which is why the check exists at all.
    const keys = Object.keys(POLICY_DEFINITIONS);
    assert.ok(keys.length >= 12, `expected at least 12 policies, found ${keys.length}`);
    assert.ok(keys.includes("institution.timezone"), "the timezone gates the Lesson Sheet release window");
    const registry = readFileSync(join(ROOT, "src", "lib", "academy", "policies", "registry.ts"), "utf8");
    assert.doesNotMatch(registry, /\bdefault:/, "a silent default would hide an unconfigured academy");
  });

  test("it checks the account tables, the extension, an administrator and the minimum content", () => {
    for (const needle of [
      "profiles",
      "verification_codes",
      "uuid-ossp",
      "An active administrator exists",
      "academy_programs",
      "academy_courses",
      "academy_curriculum_versions",
      "academy_class_groups",
      "academy_sessions",
      "academy_offers",
      "academy_class_group_teachers",
    ]) {
      assert.ok(code.includes(needle), `the check must cover ${needle}`);
    }
  });

  test("it names every configuration value a launch flow depends on", () => {
    for (const name of [
      "ACADEMY_CORE_SCHEMA_READY",
      "INTERNAL_API_SECRET",
      "EMAIL_USER",
      "EMAIL_PASS",
      "EMAIL_FROM",
      "FIREBASE_ADMIN_KEY",
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      "NEXT_PUBLIC_SITE_URL",
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
      "WHOP_API_KEY",
      "WHOP_WEBHOOK_SECRET",
    ]) {
      assert.ok(code.includes(name), `the check must report ${name}`);
    }
  });

  test("a failure is fatal, so the gate cannot be opened on a green-looking run", () => {
    assert.match(code, /process\.exitCode = failed\.length > 0 \? 1 : 0;/);
    assert.match(code, /Not ready to open the gate/);
  });
});
