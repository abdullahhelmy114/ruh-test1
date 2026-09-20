/**
 * The account tables and their recovery script.
 *
 * The database the deployment runs on has the academy schema but neither
 * account table, so every signed-in path fails: src/lib/auth/index.ts resolves
 * the caller from `profiles`, and sign-up and verification use
 * `verification_codes`. db/recovery/0001_account_tables.up.sql recreates them.
 *
 * The definitions in that script are the ones the application has always run
 * on: a live schema snapshot taken 2026-09-16 and the catalog of the isolated
 * test branch agree column for column. The repository itself never held them
 * (src/lib/db/schema.sql has an 8-column `profiles` and no
 * `verification_codes`), so these tests are what keeps the script honest: the
 * exact columns, in order, with their constraints, and nothing else.
 *
 * They also pin two rules: the script carries no account data, and no code
 * path anywhere grants the administrator role (it is established once, by an
 * approved statement, as db/recovery/README.md sets out).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const RECOVERY = join(ROOT, "db", "recovery");
const read = (name: string) => readFileSync(join(RECOVERY, name), "utf8");
/** SQL with comments removed, so a comment cannot satisfy or break an assertion. */
const sql = (name: string) => read(name).replace(/^\s*--.*$/gm, "");

const UP = "0001_account_tables.up.sql";
const DOWN = "0001_account_tables.down.sql";

/** The verified column list, in order, from the 2026-09-16 snapshot and the test branch catalog. */
const PROFILES_COLUMNS = [
  "id", "firebase_uid", "email", "full_name", "role", "plan", "status", "created_at",
  "certification_progress", "teacher_uid", "referral_code", "referral_count", "credits",
  "email_verified", "profile_completed", "bio", "country", "interests", "referred_by",
  "fcm_token", "whatsapp", "telegram", "social_links", "cv_url", "intro_video_url",
  "languages", "nationality", "gender", "age", "country_of_residence", "is_verified",
  "referral_discount_used", "referral_credits",
] as const;
const VERIFICATION_CODES_COLUMNS = ["id", "user_uid", "email_code", "expires_at", "created_at"] as const;

/** The column definitions inside a CREATE TABLE, in order (constraint lines excluded). */
function columnsOf(script: string, table: string): string[] {
  const start = script.indexOf(`CREATE TABLE IF NOT EXISTS public.${table} (`);
  assert.notEqual(start, -1, `${table} is not created`);
  const body = script.slice(start + script.slice(start).indexOf("(") + 1, start + script.slice(start).indexOf("\n);"));
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^CONSTRAINT\b/i.test(line))
    .map((line) => line.split(/\s+/)[0]);
}

describe("the account tables' recovery script", () => {
  const up = sql(UP);

  test("profiles is created with the verified 33 columns, in order", () => {
    assert.deepEqual(columnsOf(up, "profiles"), [...PROFILES_COLUMNS]);
  });

  test("verification_codes is created with the verified 5 columns, in order", () => {
    assert.deepEqual(columnsOf(up, "verification_codes"), [...VERIFICATION_CODES_COLUMNS]);
  });

  test("the keys, the role check and the defaults the application relies on are all there", () => {
    for (const constraint of [
      "CONSTRAINT profiles_pkey PRIMARY KEY (id)",
      "CONSTRAINT profiles_email_key UNIQUE (email)",
      "CONSTRAINT profiles_firebase_uid_key UNIQUE (firebase_uid)",
      "CONSTRAINT verification_codes_pkey PRIMARY KEY (id)",
    ]) {
      assert.ok(up.includes(constraint), constraint);
    }
    assert.match(up, /CONSTRAINT profiles_role_check CHECK \(\(role = ANY \(ARRAY\['admin'::text, 'teacher'::text, 'student'::text\]\)\)\)/);
    // A sign-up inserts only uid and email; every other column must default.
    assert.match(up, /id uuid NOT NULL DEFAULT uuid_generate_v4\(\)/);
    assert.match(up, /role text DEFAULT 'student'::text/);
    assert.match(up, /status text DEFAULT 'active'::text/);
    assert.match(up, /email_verified boolean DEFAULT false/);
    assert.match(up, /social_links jsonb DEFAULT '\{\}'::jsonb/);
    assert.match(up, /CREATE EXTENSION IF NOT EXISTS "uuid-ossp"/, "uuid_generate_v4() comes from this extension");
    // The routes delete the account's row before inserting the next code, so no unique key on user_uid.
    assert.doesNotMatch(up, /UNIQUE \(user_uid\)/);
  });

  test("it is additive, schema only, and carries no account data", () => {
    assert.match(up, /^\s*BEGIN;/m);
    assert.match(up, /^COMMIT;/m);
    for (const forbidden of [/\bDROP\b/i, /\bALTER\b/i, /\bTRUNCATE\b/i, /\bINSERT\b/i, /\bUPDATE\b/i, /\bDELETE\b/i, /\bGRANT\b/i]) {
      assert.doesNotMatch(up, forbidden, `the recovery script must not contain ${forbidden}`);
    }
    assert.doesNotMatch(up, /academy_/, "it must not touch an academy object");
    assert.doesNotMatch(up, /@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, "no address may appear: the old accounts are not copied");
    assert.equal((up.match(/CREATE TABLE/g) ?? []).length, 2, "exactly two tables");
  });

  test("the rollback drops only those two tables, and refuses once they hold accounts", () => {
    const down = sql(DOWN);
    assert.match(down, /RAISE EXCEPTION 'Refusing to roll back/);
    assert.match(down, /DROP TABLE IF EXISTS public\.verification_codes;/);
    assert.match(down, /DROP TABLE IF EXISTS public\.profiles;/);
    assert.equal((down.match(/DROP TABLE/g) ?? []).length, 2, "it drops nothing else");
    assert.doesNotMatch(down, /academy_|DROP SCHEMA|DROP DATABASE|TRUNCATE/);
  });

  test("the recovery lives outside db/migrations, which stays academy-only", () => {
    const names = readdirSync(RECOVERY).sort();
    assert.deepEqual(names, ["0001_account_tables.down.sql", "0001_account_tables.up.sql", "README.md", "checks.sql"]);
    for (const name of readdirSync(join(ROOT, "db", "migrations"))) {
      assert.doesNotMatch(name, /account/, "account tables are not an academy migration");
    }
  });

  test("the checks are read-only", () => {
    const checks = sql("checks.sql");
    for (const forbidden of [/\bINSERT\b/i, /\bUPDATE\b/i, /\bDELETE\b/i, /\bDROP\b/i, /\bALTER\b/i, /\bCREATE\b/i, /\bTRUNCATE\b/i]) {
      assert.doesNotMatch(checks, forbidden, `checks.sql must not contain ${forbidden}`);
    }
  });
});

describe("the columns the application depends on", () => {
  test("every column the auth layer, sign-up and the academy read or write is in the definition", () => {
    // Named here so that removing one from the script fails loudly, with the caller that needs it.
    const required: ReadonlyArray<readonly [string, string]> = [
      ["firebase_uid", "src/lib/auth/index.ts resolves the caller by it"],
      ["role", "src/lib/auth/core.ts decides privileges from it"],
      ["status", "an inactive teacher is an applicant"],
      ["email", "the session and sign-up flows"],
      ["id", "12 legacy tables key their rows by it"],
      ["email_verified", "verification state, set by /api/verify-email-code"],
      ["is_verified", "verification state"],
      ["referral_code", "sign-up assigns one; /api/referral reads it"],
      ["referred_by", "invitations"],
      ["fcm_token", "/api/notifications/register"],
      ["full_name", "the academy shows it beside academy rows"],
      ["gender", "the community guard"],
      ["social_links", "the teacher application"],
      ["cv_url", "the teacher application"],
      ["country_of_residence", "the teacher application"],
    ];
    const columns = new Set<string>(PROFILES_COLUMNS);
    for (const [column, why] of required) assert.ok(columns.has(column), `${column} is missing (${why})`);
    for (const column of ["user_uid", "email_code", "expires_at"]) {
      assert.ok(new Set<string>(VERIFICATION_CODES_COLUMNS).has(column), column);
    }
  });
});

describe("the administrator role is never granted by code", () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      return statSync(path).isDirectory() ? walk(path) : path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
    });
  }

  test("no source file writes the administrator role, and the recovery script does not either", () => {
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, "src"))) {
      const src = readFileSync(file, "utf8").replace(/^\s*\/\/.*$/gm, "");
      // An INSERT or UPDATE of profiles that also names the admin role.
      for (const statement of src.match(/(INSERT INTO profiles|UPDATE profiles SET)[\s\S]{0,400}?`/g) ?? []) {
        if (/'admin'/.test(statement)) offenders.push(relative(ROOT, file).replace(/\\/g, "/"));
      }
    }
    assert.deepEqual(offenders, []);
    // The recovery script may name the role only where it lists the allowed values.
    const withoutRoleCheck = sql(UP).replace(/CONSTRAINT profiles_role_check[^\n]*\n/, "");
    assert.doesNotMatch(withoutRoleCheck, /'admin'/, "the script grants nobody the administrator role");
  });
});
