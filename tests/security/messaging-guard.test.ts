/**
 * Launch closure: the legacy direct-message route no longer lets any signed-in
 * user message any account.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Role } from "../../src/lib/auth/core.ts";
import { mayDirectMessage, type LegacyMessagingFacts } from "../../src/lib/security/messaging-guard.ts";

const ROLES: Record<string, Role> = {
  "admin-1": "admin",
  "teacher-1": "teacher",
  "teacher-2": "teacher",
  "student-1": "student",
  "student-2": "student",
};

function facts(relationships: [string, string][] = [["teacher-1", "student-1"]]): LegacyMessagingFacts & { relationshipChecks: number } {
  const state = {
    relationshipChecks: 0,
    async roleOf(uid: string) {
      return ROLES[uid] ?? null;
    },
    async hasTeachingRelationship(teacherUid: string, learnerUid: string) {
      state.relationshipChecks++;
      return relationships.some(([t, l]) => t === teacherUid && l === learnerUid);
    },
  };
  return state;
}

const as = (uid: string) => ({ uid, role: ROLES[uid] });

describe("legacy direct-message authorization", () => {
  test("administrators may message anyone and anyone may message an administrator", async () => {
    assert.equal(await mayDirectMessage(as("admin-1"), "student-2", facts()), true);
    assert.equal(await mayDirectMessage(as("admin-1"), "teacher-2", facts()), true);
    assert.equal(await mayDirectMessage(as("student-2"), "admin-1", facts()), true);
    assert.equal(await mayDirectMessage(as("teacher-2"), "admin-1", facts()), true);
  });

  test("a learner and a teacher need an active academic relationship, in both directions", async () => {
    assert.equal(await mayDirectMessage(as("student-1"), "teacher-1", facts()), true);
    assert.equal(await mayDirectMessage(as("teacher-1"), "student-1", facts()), true);
    assert.equal(await mayDirectMessage(as("student-1"), "teacher-2", facts()), false);
    assert.equal(await mayDirectMessage(as("teacher-2"), "student-1", facts()), false);
    assert.equal(await mayDirectMessage(as("student-2"), "teacher-1", facts()), false);
  });

  test("learner-to-learner, teacher-to-teacher and self messages are refused without a relationship lookup", async () => {
    const f = facts([["student-2", "student-1"]]);
    assert.equal(await mayDirectMessage(as("student-1"), "student-2", f), false);
    assert.equal(await mayDirectMessage(as("teacher-1"), "teacher-2", f), false);
    assert.equal(await mayDirectMessage(as("student-1"), "student-1", f), false);
    assert.equal(f.relationshipChecks, 0);
  });

  test("an unknown recipient is refused exactly like a forbidden one", async () => {
    assert.equal(await mayDirectMessage(as("student-1"), "ghost-account", facts()), false);
    assert.equal(await mayDirectMessage(as("admin-1"), "ghost-account", facts()), false);
  });
});

describe("legacy /api/messages route wiring", () => {
  const src = readFileSync(join(import.meta.dirname, "..", "..", "src", "app", "api", "messages", "route.ts"), "utf8");

  test("authorization runs after input checks and before any write, notification or push", () => {
    const guardAt = src.indexOf("await mayDirectMessage(");
    assert.ok(guardAt > src.indexOf("isFirebaseUidShape(receiverUid)"));
    assert.ok(guardAt < src.indexOf("INSERT INTO messages"));
    assert.ok(guardAt < src.indexOf("INSERT INTO notifications"));
    assert.ok(guardAt < src.indexOf("getAdminMessaging()"));
    assert.match(src, /mayDirectMessage\(\{ uid: user\.uid, role: user\.role \}, receiverUid/);
  });

  test("one generic 403 for every refusal; no existence oracle", () => {
    assert.equal((src.match(/status: 403/g) ?? []).length, 1);
    assert.match(src, /\{ error: 'Forbidden' \}, \{ status: 403 \}/);
    assert.equal(/not found/i.test(src), false);
  });

  test("the legacy relationship requires an enrollment still in progress in the teacher's course", () => {
    assert.match(src, /JOIN course c ON c\.id = e\.course_id[\s\S]*c\.teacher_uid = \$\{teacherUid\}[\s\S]*COALESCE\(e\.completed, false\) = false/);
    assert.match(src, /academyFlags\.coreSchemaReady \? relationshipFacts\.hasActiveTeachingRelationship/);
  });
});
