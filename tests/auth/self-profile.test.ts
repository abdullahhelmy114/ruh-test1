/**
 * Self-profile updates (PATCH /api/user) and the profile screens.
 *
 * The profile screens for every role used to report "saved" after writing only
 * to browser storage. These tests pin down what each role may change, that
 * identity and access fields are never accepted, that values follow the
 * teacher application's rules, that the write is bound to the account's own
 * row, role and (for teachers) active status, and that the screens report
 * success only from the server.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HttpError, type Role } from "../../src/lib/auth/core.ts";
import { EDITABLE_FIELDS, TEACHER_APPLICANT_MESSAGE, planProfileUpdate, profileUpdateQuery } from "../../src/lib/profile/self-profile.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8");

function refused(fn: () => unknown, status: number, message?: RegExp) {
  assert.throws(fn, (error: unknown) => error instanceof HttpError && error.status === status && (!message || message.test(error.message)));
}

const student = { role: "student" as Role, status: "active" };
const admin = { role: "admin" as Role, status: null };
const teacher = { role: "teacher" as Role, status: "active" };
const BIO = "I have taught Arabic grammar and Quranic reading to adult learners for twelve years.";

describe("what each account may change about itself", () => {
  test("students and administrators change their name, origin and contact details", () => {
    const plan = planProfileUpdate(student, { fullName: "  Amina Rahman ", gender: "female", nationality: "Egypt", countryOfResidence: "Türkiye", whatsapp: "+90 555 123 4567", telegram: "amina_r" });
    assert.deepEqual(plan.changes, [
      { column: "full_name", value: "Amina Rahman" },
      { column: "gender", value: "female" },
      { column: "nationality", value: "Egypt" },
      { column: "country_of_residence", value: "Türkiye" },
      { column: "whatsapp", value: "+90 555 123 4567" },
      { column: "telegram", value: "@amina_r" },
    ]);
    assert.equal(plan.requireActive, false);
    assert.deepEqual(planProfileUpdate(admin, { fullName: "Office" }).changes, [{ column: "full_name", value: "Office" }]);
    refused(() => planProfileUpdate(admin, { gender: "male" }), 400, /gender cannot be changed here/);
  });

  test("a student or administrator can clear optional contact details, never the name", () => {
    assert.deepEqual(planProfileUpdate(student, { whatsapp: "", telegram: null, nationality: "" }).changes, [
      { column: "nationality", value: null },
      { column: "whatsapp", value: null },
      { column: "telegram", value: null },
    ]);
    refused(() => planProfileUpdate(student, { fullName: "" }), 400);
  });

  test("an active teacher changes the biography, contact details and profile links; reviewed identity stays as approved", () => {
    const plan = planProfileUpdate(teacher, { bio: `  ${BIO}\r\n`, whatsapp: "+201000000000", telegram: "@maryam_teaches", socialLinks: [{ platform: "LinkedIn", url: "https://www.linkedin.com/in/maryam" }, { platform: "", url: "" }] });
    assert.deepEqual(plan.changes, [
      { column: "whatsapp", value: "+201000000000" },
      { column: "telegram", value: "@maryam_teaches" },
      { column: "bio", value: BIO },
      { column: "social_links", value: JSON.stringify([{ platform: "LinkedIn", url: "https://www.linkedin.com/in/maryam" }]) },
    ]);
    assert.equal(plan.requireActive, true);
    for (const field of ["fullName", "gender", "nationality", "countryOfResidence", "languages"]) {
      refused(() => planProfileUpdate(teacher, { [field]: "x" }), 400, /cannot be changed here/);
    }
    refused(() => planProfileUpdate(teacher, { whatsapp: "" }), 400, /whatsapp must be a phone number|whatsapp is required/);
    refused(() => planProfileUpdate(teacher, { bio: "Too short." }), 400, /bio must be between/);
    refused(() => planProfileUpdate(teacher, { socialLinks: [{ platform: "Site", url: "http://example.test" }] }), 400, /https link/);
  });

  test("a teacher account that is not active changes nothing here: its details are its application", () => {
    for (const status of ["pending", "changes_requested", "rejected", "withdrawn", "inactive", null, undefined]) {
      refused(() => planProfileUpdate({ role: "teacher", status }, { whatsapp: "+201000000000" }), 409, new RegExp(TEACHER_APPLICANT_MESSAGE.slice(0, 30)));
    }
  });

  test("identity, access and referral fields are never accepted, for any role", () => {
    for (const account of [student, admin, teacher]) {
      for (const field of ["uid", "firebase_uid", "email", "role", "status", "email_verified", "emailVerified", "referral_code", "referred_by", "fcm_token", "plan", "full_name", "id"]) {
        refused(() => planProfileUpdate(account, { [field]: "admin" }), 400, /cannot be changed here/);
      }
    }
    for (const body of [null, undefined, "fullName=x", [], {}]) refused(() => planProfileUpdate(student, body), 400);
    assert.deepEqual(Object.keys(EDITABLE_FIELDS).sort(), ["admin", "student", "teacher"]);
  });

  test("invalid values are refused with a message fit for the screen", () => {
    refused(() => planProfileUpdate(student, { gender: "other" }), 400, /gender is not valid/);
    refused(() => planProfileUpdate(student, { whatsapp: "call me" }), 400, /whatsapp must be a phone number/);
    refused(() => planProfileUpdate(student, { telegram: "a b" }), 400, /telegram must be a Telegram username/);
    refused(() => planProfileUpdate(student, { nationality: "x".repeat(81) }), 400, /at most 80/);
    refused(() => planProfileUpdate(student, { fullName: "line\nbreak" }), 400, /single line/);
  });
});

describe("the profile write", () => {
  test("updates only the account's own row while it keeps the role (and active status) the change was planned for", () => {
    const query = profileUpdateQuery("uid-1", planProfileUpdate(teacher, { telegram: "maryam_t", bio: BIO }));
    assert.equal(query.text, "UPDATE profiles SET telegram = $1, bio = $2 WHERE firebase_uid = $3 AND role = $4 AND status = 'active' RETURNING firebase_uid");
    assert.deepEqual(query.values, ["@maryam_t", BIO, "uid-1", "teacher"]);
    const studentQuery = profileUpdateQuery("uid-2", planProfileUpdate(student, { fullName: "A'; DROP TABLE profiles; --" }));
    assert.equal(studentQuery.text, "UPDATE profiles SET full_name = $1 WHERE firebase_uid = $2 AND role = $3 RETURNING firebase_uid");
    assert.deepEqual(studentQuery.values, ["A'; DROP TABLE profiles; --", "uid-2", "student"], "values are parameters, never text");
  });

  test("the route takes role and status from the stored account, reports a changed account as a conflict and is not cached", () => {
    const src = read("src", "app", "api", "user", "route.ts");
    const patch = src.slice(src.indexOf("export const PATCH"), src.indexOf("export async function POST"));
    assert.match(patch, /export const PATCH = withApi\(async \(req\) => \{\s*const user = await requireAuth\(req\);/);
    assert.match(patch, /const role = user\.accountRole \?\? \(user\.role === 'applicant' \? 'teacher' : user\.role\);/);
    assert.match(patch, /planProfileUpdate\(\{ role, status: user\.accountStatus \}, await req\.json\(\)\.catch\(\(\) => null\)\)/);
    assert.match(patch, /profileUpdateQuery\(user\.uid, plan\)/);
    assert.match(patch, /if \(rows\.length === 0\) throw new HttpError\(409,/);
    assert.match(patch, /'Cache-Control': 'private, no-store'/);
    assert.doesNotMatch(patch, /body\.(uid|role|status|email)/);
  });
});

describe("profile screens", () => {
  const screens = ["StudentProfile.tsx", "TeacherProfile.tsx", "AdminProfile.tsx"].map((name) => [name, read("src", "components", "profile", name)] as const);

  test("load and save through the server only, and report success only after it stored the change", () => {
    for (const [name, src] of screens) {
      assert.doesNotMatch(src, /localStorage|sessionStorage/, name);
      assert.match(src, /const result = await loadOwnProfile\(\);/, name);
      assert.match(src, /const result = await saveOwnProfile\(\{/, name);
      assert.match(src, /if \(!result\.ok\) \{\s*setSave\("idle"\);\s*toast\.error\(result\.message\);\s*return;\s*\}\s*setSave\("success"\);/, name);
      assert.doesNotMatch(src, /onAvatar=/, `${name}: the picture cannot be saved, so no upload is offered`);
    }
    const api = read("src", "components", "profile", "profile-api.ts");
    assert.match(api, /authFetch\("\/api\/user", \{ method: "PATCH", body: JSON\.stringify\(changes\) \}\)/);
  });

  test("screens send only fields their role may change", () => {
    // Top-level keys of the object passed to saveOwnProfile (shorthand or `key: value`).
    const fieldsSent = (src: string) => {
      const start = src.indexOf("saveOwnProfile({") + "saveOwnProfile(".length;
      let depth = 0;
      let segment = "";
      const keys: string[] = [];
      for (const char of src.slice(start)) {
        if ("{([".includes(char)) depth++;
        if ("})]".includes(char)) depth--;
        if (depth === 0) break;
        if (depth === 1 && char === ",") {
          keys.push(segment);
          segment = "";
        } else if (depth === 1 && char !== "{") segment += char;
      }
      keys.push(segment);
      return keys.map((k) => /^\s*(\w+)/.exec(k)?.[1]).filter((k): k is string => Boolean(k)).sort();
    };
    const byName = Object.fromEntries(screens);
    assert.deepEqual(fieldsSent(byName["StudentProfile.tsx"]), [...EDITABLE_FIELDS.student].filter((f) => f !== "fullName").sort());
    assert.deepEqual(fieldsSent(byName["AdminProfile.tsx"]), [...EDITABLE_FIELDS.admin].sort());
    assert.deepEqual(fieldsSent(byName["TeacherProfile.tsx"]), [...EDITABLE_FIELDS.teacher].sort());
    assert.match(byName["TeacherProfile.tsx"], /if \(!s \|\| !active\) return;/, "a teacher applicant has no save");
  });

  test("no invented figures are shown as account facts", () => {
    for (const [name, src] of screens) assert.doesNotMatch(src, /"248"|"B1"|value: "All"|value: "5"/, name);
  });
});
