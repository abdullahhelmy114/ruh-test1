/**
 * Launch readiness check - READ ONLY.
 *
 * The academy is gated by ACADEMY_CORE_SCHEMA_READY. Turning that variable on
 * is only safe when the things the academy assumes are actually there, so this
 * script proves them against the database the deployment will use, before the
 * switch is flipped. It answers one question: if the gate were opened now,
 * would the academy work?
 *
 * It runs SELECT statements only. It creates nothing, changes nothing and
 * deletes nothing. It prints counts, names and booleans - never a secret, an
 * email address, a uid, a token or a row of account data.
 *
 *   node scripts/launch-readiness-check.mjs
 *
 * DATABASE_URL decides which database is inspected; the endpoint id is printed
 * so the operator can confirm the target before trusting the result. Exit code
 * 0 means every gate passed, 1 means at least one gate failed.
 */
import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { POLICY_DEFINITIONS } from "../src/lib/academy/policies/registry.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(ROOT, "package.json"));
require("@next/env").loadEnvConfig(ROOT, false, { info() {}, error() {} });
const { neon } = require("@neondatabase/serverless");

const gates = [];
const record = (gate, status, detail) => {
  gates.push({ gate, status, detail });
  console.log(`${status}  ${gate}${detail ? ` - ${detail}` : ""}`);
};

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (its value is never printed). Nothing was inspected.");
  process.exit(1);
}
const url = new URL(process.env.DATABASE_URL);
const endpoint = url.hostname.split(".")[0].replace(/-pooler$/, "");
console.log(`Target: endpoint ${endpoint}, database ${url.pathname.slice(1).split("?")[0]}\n`);
const sql = neon(process.env.DATABASE_URL);

/** Every academy table the migrations create. */
const migrationTables = new Set();
for (const file of readdirSync(join(ROOT, "db", "migrations")).filter((name) => name.endsWith(".up.sql"))) {
  const text = readFileSync(join(ROOT, "db", "migrations", file), "utf8");
  for (const m of text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(academy_[a-z0-9_]+)/gi)) {
    migrationTables.add(m[1].toLowerCase());
  }
}

// ---------------------------------------------------------------------------
// 1. Schema
// ---------------------------------------------------------------------------
const present = new Set(
  (await sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")).map((r) => r.table_name),
);
const missingAcademy = [...migrationTables].filter((t) => !present.has(t)).sort();
record(
  "Academy schema (migrations 0001-0011)",
  missingAcademy.length === 0 ? "PASS" : "FAIL",
  missingAcademy.length === 0 ? `${migrationTables.size} tables present` : `missing: ${missingAcademy.join(", ")}`,
);

for (const [table, expectedColumns] of [["profiles", 33], ["verification_codes", 5]]) {
  if (!present.has(table)) {
    record(`Account table ${table}`, "FAIL", "absent - sign-in and sign-up cannot work (see db/recovery/)");
    continue;
  }
  const [{ columns }] = await sql.query(
    "SELECT count(*)::int AS columns FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
    [table],
  );
  record(`Account table ${table}`, columns === expectedColumns ? "PASS" : "WARN", `${columns} columns (expected ${expectedColumns})`);
}

const [{ uuid_ossp }] = await sql.query("SELECT (count(*) > 0) AS uuid_ossp FROM pg_extension WHERE extname = 'uuid-ossp'");
record("Extension uuid-ossp (profiles.id default)", uuid_ossp ? "PASS" : "FAIL", uuid_ossp ? "installed" : "missing: profile inserts would fail");

// ---------------------------------------------------------------------------
// 2. Policies - every definition needs a value, because none has a default
// ---------------------------------------------------------------------------
const policyKeys = Object.keys(POLICY_DEFINITIONS).sort();
let configured = [];
if (present.has("academy_policy_values")) {
  configured = (await sql.query("SELECT DISTINCT policy_key FROM academy_policy_values")).map((r) => r.policy_key);
}
const missingPolicies = policyKeys.filter((key) => !configured.includes(key));
record(
  "Academy policies configured",
  missingPolicies.length === 0 ? "PASS" : "FAIL",
  missingPolicies.length === 0 ? `all ${policyKeys.length} set` : `${missingPolicies.length} of ${policyKeys.length} unset: ${missingPolicies.join(", ")}`,
);
record(
  "institution.timezone (gates the Lesson Sheet release window)",
  configured.includes("institution.timezone") ? "PASS" : "FAIL",
  configured.includes("institution.timezone") ? "set" : "unset: lesson sheets stay unavailable",
);

// ---------------------------------------------------------------------------
// 3. Accounts - counts only
// ---------------------------------------------------------------------------
if (present.has("profiles")) {
  const roles = await sql.query("SELECT role, status, count(*)::int AS n FROM profiles GROUP BY 1,2 ORDER BY 1,2");
  const admins = roles.filter((r) => r.role === "admin" && r.status === "active").reduce((sum, r) => sum + r.n, 0);
  record("An active administrator exists", admins > 0 ? "PASS" : "FAIL", `${admins} active administrator account(s)`);
  console.log(`      accounts by role/status: ${roles.map((r) => `${r.role}/${r.status}=${r.n}`).join(", ") || "none"}`);
}

// ---------------------------------------------------------------------------
// 4. The minimum content a controlled launch needs
// ---------------------------------------------------------------------------
for (const [table, what] of [
  ["academy_programs", "a program"],
  ["academy_courses", "a course"],
  ["academy_curriculum_versions", "a curriculum version"],
  ["academy_class_groups", "a class group"],
  ["academy_sessions", "a scheduled session"],
  ["academy_offers", "an offer (a class group cannot be bought without one)"],
]) {
  if (!present.has(table)) continue;
  const [{ n }] = await sql.query(`SELECT count(*)::int AS n FROM ${table}`);
  record(`Content: ${what}`, n > 0 ? "PASS" : "WARN", `${n} row(s) in ${table}`);
}
if (present.has("academy_class_group_teachers")) {
  const [{ n }] = await sql.query("SELECT count(*)::int AS n FROM academy_class_group_teachers WHERE unassigned_at IS NULL");
  record("Content: a teacher assigned to a class group", n > 0 ? "PASS" : "WARN", `${n} current assignment(s)`);
}

// ---------------------------------------------------------------------------
// 5. Configuration - names and presence only, never values
// ---------------------------------------------------------------------------
const flag = process.env.ACADEMY_CORE_SCHEMA_READY;
record(
  "ACADEMY_CORE_SCHEMA_READY",
  flag === "true" ? "PASS" : "WARN",
  flag === "true"
    ? "true - the academy is open"
    : `not "true" - every academy service answers 503 (currently ${flag === undefined ? "unset" : "set to another value"})`,
);
for (const [name, enables] of [
  ["INTERNAL_API_SECRET", "sign-up and email verification codes"],
  ["EMAIL_USER", "verification email delivery"],
  ["EMAIL_PASS", "verification email delivery"],
  ["EMAIL_FROM", "the verification email sender"],
  ["FIREBASE_ADMIN_KEY", "server-side identity verification"],
  ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", "browser sign-in"],
  ["NEXT_PUBLIC_SITE_URL", "the Whop return address"],
  ["CLOUDINARY_CLOUD_NAME", "teacher CV and video upload"],
  ["CLOUDINARY_API_KEY", "teacher CV and video upload"],
  ["CLOUDINARY_API_SECRET", "teacher CV and video upload"],
]) {
  record(`Configuration ${name}`, process.env[name] ? "PASS" : "FAIL", process.env[name] ? `set (${enables})` : `unset - blocks ${enables}`);
}
for (const [name, enables] of [
  ["WHOP_API_KEY", "checkout creation"],
  ["WHOP_WEBHOOK_SECRET", "webhook verification"],
  ["WHOP_API_BASE_URL", "the sandbox/production choice"],
]) {
  record(`Configuration ${name}`, process.env[name] ? "PASS" : "WARN", process.env[name] ? `set (${enables})` : `unset - ${enables} unavailable (payments stay closed)`);
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------
const failed = gates.filter((g) => g.status === "FAIL");
const warned = gates.filter((g) => g.status === "WARN");
console.log(`\n${gates.length - failed.length - warned.length} passed, ${warned.length} warning(s), ${failed.length} failure(s).`);
if (failed.length > 0) {
  console.log("\nNot ready to open the gate. Failures:");
  for (const g of failed) console.log(`  - ${g.gate}: ${g.detail}`);
}
process.exitCode = failed.length > 0 ? 1 : 0;
