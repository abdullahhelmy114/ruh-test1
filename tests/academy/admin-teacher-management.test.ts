/**
 * Administrator teacher management: the review queue, the full decision
 * lifecycle on the revisions the administrator saw, teacher account
 * deactivation and reactivation (and what that does to teaching access),
 * the teacher picker offering only active teachers, the screens' contract
 * with the administrator routes, and the retirement of the legacy approval
 * routes and screens.
 *
 * Service behaviour is exercised against the fake executor; route and screen
 * contracts are checked statically against the files that serve them.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { accountHome, TEACHER_APPLICATION_HOME, TEACHER_WORKSPACE_HOME } from "../../src/lib/auth/home.ts";
import { sessionRoleFor, type AuthUser } from "../../src/lib/auth/core.ts";
import { adminApi } from "../../src/components/academy/workspace/admin/api-paths.ts";
import { TEACHER_APPLICATION_STATES } from "../../src/lib/academy/domain/states.ts";
import { createSqlRelationshipFacts } from "../../src/lib/academy/repo/relationship-facts.ts";
import * as repo from "../../src/lib/academy/repo/teacher-repo.ts";
import { createTeacherService, type DocumentLinks, type IdentityDirectory } from "../../src/lib/academy/services/teacher-service.ts";
import {
  AWAITING_DECISION_FILTER,
  AWAITING_DECISION_STATES,
  TEACHER_ACCOUNT_STATUSES,
  accountStatusFor,
  adminCommandsFor,
  parseApplicationDetails,
  teacherAccountStatusKey,
  type TeacherApplicationRecord,
} from "../../src/lib/academy/teachers/applications.ts";
import { admin, admin2, fakeExecutor, fixedClock, rejectsDomain, rejectsForbidden, sequentialIds, student, teacher, type FakeExecutor } from "./support.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8");

const APPLICATION_ID = "b8b8b8b8-0000-4000-8000-000000000001";
const CV = "teacher-signup/cv/0f6d2b1e-8a4c-4f5e-9b7d-3c2a1e0f9d8b.pdf";
const DETAILS = parseApplicationDetails({
  firstName: "Maryam",
  lastName: "Yusuf",
  countryOfResidence: "TR",
  nationality: "EG",
  gender: "female",
  languages: [{ code: "ar", proficiency: "native" }],
  whatsapp: "+90 555 123 4567",
  telegram: "maryam_teaches",
  bio: "I have taught Arabic grammar and Quranic reading to adult learners for twelve years.",
  socialLinks: [],
});

const applicantUser = (status: string | null): AuthUser => ({ uid: "applicant-1", profileId: "p-applicant-1", role: sessionRoleFor("teacher", status), email: null, accountRole: "teacher", accountStatus: status });

function applicationRow(overrides: Partial<TeacherApplicationRecord> = {}): Record<string, unknown> {
  const r: TeacherApplicationRecord = {
    id: APPLICATION_ID, applicantUid: "applicant-1", state: "submitted", details: DETAILS, cvPublicId: CV, introVideoPublicId: null, revision: 1,
    submittedAt: "2026-09-10T08:00:00.000Z", decidedAt: null, decidedBy: null, decisionReason: null, createdAt: "2026-09-10T08:00:00.000Z",
    updatedAt: "2026-09-10T08:00:00.000Z", ...overrides,
  };
  return {
    id: r.id, applicant_uid: r.applicantUid, state: r.state, details: r.details, cv_public_id: r.cvPublicId, intro_video_public_id: r.introVideoPublicId,
    revision: r.revision, submitted_at: r.submittedAt, decided_at: r.decidedAt, decided_by: r.decidedBy, decision_reason: r.decisionReason,
    created_at: r.createdAt, updated_at: r.updatedAt,
  };
}

const identity: IdentityDirectory = { signInAccount: async () => ({ exists: true, disabled: false, emailVerified: true }) };
const documents: DocumentLinks = { temporaryLink: (kind) => ({ url: `https://files.example.test/${kind}`, expiresAt: "2026-09-17T12:05:00.000Z" }) };

function service(executor: FakeExecutor) {
  return createTeacherService({ executor, flags: { coreSchemaReady: true }, clock: fixedClock, newId: sequentialIds("c3c3c3c3"), identity, documents });
}

/** A database stand-in for one application and its account; the test applies each committed change. */
function database(initial: { state: TeacherApplicationRecord["state"]; revision: number; account: { role: string; status: string | null } | null }) {
  const current = { ...initial };
  const executor = fakeExecutor([
    { match: /FROM academy_teacher_applications a WHERE a\.id = \$1::uuid$/, rows: () => [applicationRow({ state: current.state, revision: current.revision })] },
    { match: /FROM academy_teacher_applications a WHERE a\.applicant_uid = \$1/, rows: () => [applicationRow({ state: current.state, revision: current.revision })] },
    {
      match: /FROM profiles WHERE firebase_uid = \$1$/,
      rows: () => (current.account ? [{ firebase_uid: "applicant-1", role: current.account.role, status: current.account.status, email: "m@example.test", email_verified: true, full_name: "Maryam Yusuf" }] : []),
    },
  ]);
  return { current, executor };
}

/** The account status write of an application transaction: [to, uid, from, acceptMissingStatus, requireVerifiedEmail, expected rows]. */
const accountWrite = (executor: FakeExecutor) => executor.transactions.at(-1)?.[3]?.values;

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------

describe("the review queue", () => {
  test("waiting for a decision means exactly the states an administrator can approve from", () => {
    assert.deepEqual([...AWAITING_DECISION_STATES], TEACHER_APPLICATION_STATES.filter((state) => adminCommandsFor(state).includes("approve")));
    assert.equal(AWAITING_DECISION_STATES.includes("changes_requested"), false, "a change request waits for the applicant");
  });

  test("the list filter is the queue, one state, or everything; anything else is refused before a query", async () => {
    const cases: [unknown, unknown][] = [
      [AWAITING_DECISION_FILTER, ["submitted", "in_review", "interview"]],
      ["rejected", ["rejected"]],
      [undefined, null],
      ["", null],
      [null, null],
    ];
    for (const [state, expected] of cases) {
      const executor = fakeExecutor();
      await service(executor).listApplications(admin, { state });
      assert.deepEqual(executor.queries[0].values, [expected], String(state));
      assert.match(executor.queries[0].text, /WHERE \(\$1::text\[\] IS NULL OR a\.state = ANY\(\$1::text\[\]\)\)/);
    }
    const bogus = fakeExecutor();
    await rejectsDomain(service(bogus).listApplications(admin, { state: "approved' OR 1=1" }), "VALIDATION");
    assert.equal(bogus.queries.length, 0);
  });

  test("list rows carry the applicant's name and account facts, never document storage ids or contact details", async () => {
    const executor = fakeExecutor([{ match: /FROM academy_teacher_applications a\s+LEFT JOIN profiles/, rows: [{ ...applicationRow(), email: "m@example.test", email_verified: false, account_status: "pending" }] }]);
    const [row] = await service(executor).listApplications(admin, { state: AWAITING_DECISION_FILTER });
    assert.deepEqual(row, {
      id: APPLICATION_ID, applicantUid: "applicant-1", name: "Maryam Yusuf", email: "m@example.test", emailVerified: false, accountStatus: "pending",
      state: "submitted", revision: 1, submittedAt: "2026-09-10T08:00:00.000Z", updatedAt: "2026-09-10T08:00:00.000Z",
    });
    const json = JSON.stringify(row);
    for (const secret of [CV, "+90 555", "maryam_teaches"]) assert.equal(json.includes(secret), false, secret);
  });

  test("an applicant reads only their own application: the query is keyed by the session account, never by a supplied id", async () => {
    const executor = fakeExecutor();
    await service(executor).myApplication(applicantUser("pending"));
    assert.deepEqual(executor.queries[0].values, ["applicant-1"]);
    const route = read("src", "app", "api", "academy", "teacher-application", "route.ts");
    assert.doesNotMatch(route, /applicationId|searchParams|body\.(uid|applicantUid|id)\b/);
    // The administrator routes, which do take an application id, refuse anyone who is not an administrator.
    for (const user of [applicantUser("pending"), applicantUser("changes_requested"), teacher, student]) {
      const refused = fakeExecutor();
      await rejectsForbidden(service(refused).getApplication(user, APPLICATION_ID));
      await rejectsForbidden(service(refused).openDocument(user, APPLICATION_ID, "cv"));
      assert.equal(refused.queries.length + refused.transactions.length, 0);
    }
  });
});

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

describe("the decision lifecycle", () => {
  test("submitted → review → interview → changes requested → resubmitted → approved, each step on the revision just seen, the account following", async () => {
    const db = database({ state: "submitted", revision: 1, account: { role: "teacher", status: "pending" } });
    const svc = service(db.executor);
    const steps: [string, string | undefined, TeacherApplicationRecord["state"], string, string][] = [
      ["start_review", undefined, "in_review", "pending", "pending"],
      ["schedule_interview", undefined, "interview", "pending", "pending"],
      ["request_changes", "Please add your ijazah details.", "changes_requested", "pending", "changes_requested"],
    ];
    for (const [command, reason, state, from, to] of steps) {
      const result = await svc.decide(admin, APPLICATION_ID, { command, reason, expectedRevision: db.current.revision });
      assert.deepEqual(result, { id: APPLICATION_ID, state, revision: db.current.revision + 1, accountStatus: to });
      assert.deepEqual(accountWrite(db.executor)?.slice(0, 3), [to, "applicant-1", from], command);
      Object.assign(db.current, { state: result.state, revision: result.revision, account: { role: "teacher", status: result.accountStatus } });
    }
    // The applicant sees the note and revises; the account returns to pending.
    const view = await svc.myApplication(applicantUser("changes_requested"));
    assert.equal(view.canRevise, true);
    const revised = await svc.resubmitApplication(applicantUser("changes_requested"), { details: DETAILS, expectedRevision: db.current.revision });
    assert.deepEqual(accountWrite(db.executor)?.slice(0, 3), ["pending", "applicant-1", "changes_requested"]);
    Object.assign(db.current, { state: revised.state, revision: revised.revision, account: { role: "teacher", status: "pending" } });
    assert.equal(db.current.state, "submitted");

    const approved = await svc.decide(admin2, APPLICATION_ID, { command: "approve", expectedRevision: db.current.revision });
    assert.deepEqual(approved, { id: APPLICATION_ID, state: "approved", revision: 6, accountStatus: "active" });
    assert.deepEqual(accountWrite(db.executor), ["active", "applicant-1", "pending", false, true, 1], "approval requires a verified email in the same statement");
    // Once the database commits, the same account's next request is a teacher session that lands in the workspace.
    assert.equal(sessionRoleFor("teacher", approved.accountStatus), "teacher");
    assert.equal(accountHome("teacher", approved.accountStatus), TEACHER_WORKSPACE_HOME);
    assert.equal(db.executor.transactions.length, 5);
  });

  test("rejection is final and keeps the account out of teaching", async () => {
    const db = database({ state: "in_review", revision: 2, account: { role: "teacher", status: "pending" } });
    await rejectsDomain(service(db.executor).decide(admin, APPLICATION_ID, { command: "reject", expectedRevision: 2 }), "VALIDATION");
    assert.equal(db.executor.transactions.length, 0, "a rejection needs a note to the applicant");
    const result = await service(db.executor).decide(admin, APPLICATION_ID, { command: "reject", reason: "We are not recruiting for this subject.", expectedRevision: 2 });
    assert.deepEqual(result, { id: APPLICATION_ID, state: "rejected", revision: 3, accountStatus: "rejected" });
    assert.equal(sessionRoleFor("teacher", "rejected"), "applicant");
    assert.equal(accountHome("teacher", "rejected"), TEACHER_APPLICATION_HOME);
    Object.assign(db.current, { state: "rejected", revision: 3, account: { role: "teacher", status: "rejected" } });
    for (const command of ["approve", "request_changes", "start_review", "reject"]) {
      await rejectsDomain(service(db.executor).decide(admin, APPLICATION_ID, { command, reason: "Again.", expectedRevision: 3 }), "INVALID_TRANSITION");
    }
    const detail = await service(db.executor).getApplication(admin, APPLICATION_ID);
    assert.deepEqual(detail.commands, [], "the review page offers nothing on a final application");
  });

  test("a transition the state does not allow is refused before writing", async () => {
    const db = database({ state: "submitted", revision: 1, account: { role: "teacher", status: "pending" } });
    await rejectsDomain(service(db.executor).decide(admin, APPLICATION_ID, { command: "schedule_interview", expectedRevision: 1 }), "INVALID_TRANSITION");
    await rejectsDomain(service(db.executor).decide(admin, APPLICATION_ID, { command: "reopen", expectedRevision: 1 }), "VALIDATION");
    await rejectsDomain(service(db.executor).decide(admin, APPLICATION_ID, { command: "approve" } as never), "VALIDATION");
    assert.equal(db.executor.transactions.length, 0);
  });

  test("the same decision sent twice: the second is on a stale revision and never reaches the database", async () => {
    const db = database({ state: "submitted", revision: 1, account: { role: "teacher", status: "pending" } });
    const first = await service(db.executor).decide(admin, APPLICATION_ID, { command: "approve", expectedRevision: 1 });
    Object.assign(db.current, { state: first.state, revision: first.revision, account: { role: "teacher", status: "active" } });
    await rejectsDomain(service(db.executor).decide(admin, APPLICATION_ID, { command: "approve", expectedRevision: 1 }), "CONFLICT");
    await rejectsDomain(service(db.executor).decide(admin2, APPLICATION_ID, { command: "reject", reason: "Late.", expectedRevision: 1 }), "CONFLICT");
    assert.equal(db.executor.transactions.length, 1);
  });

  test("no decision of any kind is made on an application whose account profile is missing or not a teacher", async () => {
    for (const account of [null, { role: "student", status: null }, { role: "admin", status: null }, { role: "teacher", status: "active" }, { role: "teacher", status: "inactive" }]) {
      for (const command of ["start_review", "request_changes", "reject", "approve"]) {
        const db = database({ state: "submitted", revision: 1, account });
        await rejectsDomain(service(db.executor).decide(admin, APPLICATION_ID, { command, reason: "A note.", expectedRevision: 1 }), "CONFLICT");
        assert.equal(db.executor.transactions.length, 0, `${JSON.stringify(account)} ${command}`);
      }
    }
  });

  test("the account status labels cover every status an application can set, and anything else is never shown as a teacher", () => {
    for (const state of TEACHER_APPLICATION_STATES) assert.ok(TEACHER_ACCOUNT_STATUSES.includes(accountStatusFor(state)), state);
    assert.equal(teacherAccountStatusKey("active"), "active");
    for (const unknown of [null, undefined, "", "Active", "approved", "teacher"]) assert.equal(teacherAccountStatusKey(unknown), "none", String(unknown));
  });
});

// ---------------------------------------------------------------------------
// Teacher accounts and access
// ---------------------------------------------------------------------------

describe("deactivation and reactivation", () => {
  const accountRules = (status: string | null, role = "teacher") => [
    { match: /FROM profiles WHERE firebase_uid = \$1$/, rows: [{ firebase_uid: "teacher-9", role, status, email: null, email_verified: true, full_name: "T" }] },
  ];

  test("deactivation ends teaching access on the next request without touching class group assignments", async () => {
    const executor = fakeExecutor(accountRules("active"));
    assert.deepEqual(await service(executor).changeTeacherAccount(admin, "teacher-9", { command: "deactivate", reason: "On leave.", expectedStatus: "active" }), { uid: "teacher-9", status: "inactive" });
    const [write] = executor.transactions[0];
    assert.match(write.text, /UPDATE profiles SET status = \$1\s+WHERE firebase_uid = \$2 AND role = 'teacher' AND status = \$3/);
    assert.equal(/academy_class_group_teachers|unassigned_at/.test(write.text), false, "assignments are kept so the class group can be reassigned or the teacher reactivated");
    assert.ok(write.values.includes("teacher.deactivate") && write.values.includes("On leave."));

    // Every request re-reads the profile: an inactive teacher is an applicant session with no role guard, and lands on the application page.
    assert.equal(sessionRoleFor("teacher", "inactive"), "applicant");
    assert.equal(accountHome("teacher", "inactive"), TEACHER_APPLICATION_HOME);
    // Relationship facts count a teacher only while the account is active, so the kept assignment grants nothing.
    const facts = fakeExecutor();
    const relationships = createSqlRelationshipFacts(facts);
    await relationships.isTeacherOfClassGroup("teacher-9", "d4d4d4d4-0000-4000-8000-000000000001");
    await relationships.hasActiveTeachingRelationship("teacher-9", "student-1");
    assert.equal(facts.queries.length, 2);
    for (const query of facts.queries) assert.match(query.text, /JOIN profiles p ON p\.firebase_uid = t\.teacher_uid AND p\.role = 'teacher' AND p\.status = 'active'/);
  });

  test("reactivation restores access through the assignments that were kept", async () => {
    const executor = fakeExecutor(accountRules("inactive"));
    assert.deepEqual(await service(executor).changeTeacherAccount(admin, "teacher-9", { command: "reactivate", expectedStatus: "inactive" }), { uid: "teacher-9", status: "active" });
    const [write] = executor.transactions[0];
    assert.equal(write.values[0], "active");
    assert.equal(write.values[2], "inactive");
    assert.ok(write.values.includes("teacher.reactivate"));
    assert.equal(sessionRoleFor("teacher", "active"), "teacher");
    assert.equal(accountHome("teacher", "active"), TEACHER_WORKSPACE_HOME);
  });

  test("reactivation is never a way around approval: only a deactivated teacher can be reactivated", async () => {
    for (const status of ["pending", "changes_requested", "rejected", "withdrawn", null]) {
      const executor = fakeExecutor(accountRules(status));
      await rejectsDomain(service(executor).changeTeacherAccount(admin, "teacher-9", { command: "reactivate", expectedStatus: status }), "CONFLICT");
      assert.equal(executor.transactions.length, 0, String(status));
    }
    for (const role of ["student", "admin"]) {
      const executor = fakeExecutor(accountRules("active", role));
      await rejectsDomain(service(executor).changeTeacherAccount(admin, "teacher-9", { command: "deactivate", reason: "x", expectedStatus: "active" }), "NOT_FOUND");
      assert.equal(executor.transactions.length, 0, role);
    }
    const deactivated = fakeExecutor(accountRules("active"));
    await rejectsDomain(service(deactivated).changeTeacherAccount(admin, "teacher-9", { command: "deactivate", expectedStatus: "active" }), "VALIDATION");
    await rejectsDomain(service(deactivated).changeTeacherAccount(admin, "teacher-9", { command: "delete", expectedStatus: "active" }), "VALIDATION");
    assert.equal(deactivated.transactions.length, 0);
  });

  test("two administrators changing the same account: the second write matches nothing and is a conflict", async () => {
    const executor = fakeExecutor(accountRules("active"));
    executor.failTransactionWith = Object.assign(new Error("academy stale write: expected 1 row(s), matched 0"), { code: "RQ409" });
    await rejectsDomain(service(executor).changeTeacherAccount(admin2, "teacher-9", { command: "deactivate", reason: "Duplicate.", expectedStatus: "active" }), "CONFLICT");
  });
});

describe("the teacher picker", () => {
  test("the active-only directory selects only teacher accounts with status active", async () => {
    const executor = fakeExecutor();
    await service(executor).listTeachers(admin, { activeOnly: true });
    assert.deepEqual(executor.queries[0].values, [true]);
    assert.match(executor.queries[0].text, /WHERE p\.role = 'teacher' AND \(NOT \$1::boolean OR p\.status = 'active'\)/);
    const all = fakeExecutor();
    await service(all).listTeachers(admin);
    assert.deepEqual(all.queries[0].values, [false], "the full directory is explicit, never the default for assignment");
    assert.match(read("src", "app", "api", "admin", "academy", "teachers", "route.ts"), /listTeachers\(user, \{ activeOnly: readBooleanParam\(req, "activeOnly"\) \}\)/);
  });

  test("the class group picker loads the active-only directory and still drops any row that is not active", () => {
    const kit = read("src", "components", "academy", "workspace", "admin", "kit.tsx");
    assert.match(kit, /useApi<Person\[\]>\(role === "teacher" \? adminApi\.teachers\(true\) : adminApi\.people, role === "teacher" \? selectActiveTeachers : selectUsers\)/);
    assert.match(kit, /\.filter\(\(teacher\) => teacher\.status === "active"\)/);
    assert.match(kit, /role === "teacher" && state\.status === "ready" && people\.length === 0[\s\S]{0,40}noActiveTeachers/);
    assert.equal(adminApi.teachers(true), "/api/admin/academy/teachers?activeOnly=true");
    // The server refuses anyone else regardless of what a screen offers.
    const deliveryRepo = read("src", "lib", "academy", "repo", "delivery-repo.ts");
    assert.match(deliveryRepo, /p\.role = 'teacher' AND p\.status = 'active'/);
  });
});

// ---------------------------------------------------------------------------
// Screens ↔ routes
// ---------------------------------------------------------------------------

const APP = join(ROOT, "src", "app");

/** The route file that serves a URL, resolving dynamic segments the way the App Router does. */
function routeFileFor(url: string): string | null {
  let dir = APP;
  for (const segment of new URL(url, "http://localhost").pathname.split("/").filter(Boolean)) {
    const literal = join(dir, segment);
    if (existsSync(literal) && statSync(literal).isDirectory()) {
      dir = literal;
      continue;
    }
    const dynamic = readdirSync(dir).find((entry) => /^\[[^.\]]+\]$/.test(entry));
    if (!dynamic) return null;
    dir = join(dir, dynamic);
  }
  const file = join(dir, "route.ts");
  return existsSync(file) ? file : null;
}

const methodsOf = (src: string) => [...src.matchAll(/^export const (GET|POST|PUT|PATCH|DELETE) = /gm)].map((m) => m[1]).sort();
const bodyKeysOf = (src: string) => [...new Set([...src.matchAll(/\bbody\.(\w+)/g)].map((m) => m[1]))].sort();

describe("teacher management screens and their routes", () => {
  const pages = join(APP, "academy", "(workspace)", "manage", "teachers");
  const list = readFileSync(join(pages, "page.tsx"), "utf8");
  const detail = readFileSync(join(pages, "applications", "[applicationId]", "page.tsx"), "utf8");
  const id = APPLICATION_ID;

  test("every path the screens use is served by an administrator route with that method", () => {
    const uses: [string, string][] = [
      [adminApi.teacherApplications(AWAITING_DECISION_FILTER), "GET"],
      [adminApi.teacherApplications(), "GET"],
      [adminApi.teachers(), "GET"],
      [adminApi.teachers(true), "GET"],
      [adminApi.teacher("teacher-9"), "PATCH"],
      [adminApi.teacherApplication(id), "GET"],
      [adminApi.teacherApplication(id), "PATCH"],
      [adminApi.teacherApplicationDocument(id, "cv"), "POST"],
      [adminApi.teacherApplicationDocument(id, "intro_video"), "POST"],
    ];
    for (const [url, method] of uses) {
      const file = routeFileFor(url);
      assert.ok(file, `no route serves ${url}`);
      const src = readFileSync(file, "utf8");
      assert.ok(methodsOf(src).includes(method), `${relative(ROOT, file)} does not export ${method}`);
      assert.match(src, /const user = await requireAdmin\(req\);/, relative(ROOT, file));
    }
    // Document links are minted by POST only (each opening is audited); there is no GET that could be prefetched or cached.
    assert.deepEqual(methodsOf(readFileSync(routeFileFor(adminApi.teacherApplicationDocument(id, "cv")) as string, "utf8")), ["POST"]);
  });

  test("the screens call exactly the paths above", () => {
    assert.match(list, /useApi<TeacherApplications>\(adminApi\.teacherApplications\(stateFilter \|\| undefined\)\)/);
    assert.match(list, /useApi<TeacherAccounts>\(adminApi\.teachers\(\)\)/);
    assert.match(detail, /useApi<TeacherApplicationReview>\(adminApi\.teacherApplication\(applicationId\)\)/);
    assert.match(detail, /action\.run<TeacherDocumentLink>\(adminApi\.teacherApplicationDocument\(applicationId, kind\), "POST"\)/);
  });

  test("the decision form sends exactly what the route reads, including the revision on screen", () => {
    const sent = /action\.run\(adminApi\.teacherApplication\(applicationId\), "PATCH", \{ command, reason: reason\.trim\(\) \|\| undefined, expectedRevision: revision \}\)/;
    assert.match(detail, sent);
    const route = readFileSync(routeFileFor(adminApi.teacherApplication(id)) as string, "utf8");
    assert.deepEqual(bodyKeysOf(route), ["command", "expectedRevision", "reason"]);
    assert.match(detail, /<Decision applicationId=\{application\.id\} revision=\{application\.revision\} commands=\{commands\} blocked=\{missing \|\| mismatch\}/);
    assert.match(detail, /FailureNotice failure=\{action\.failure\} onRetry=\{onDecided\}/, "a refused decision offers to reload the application");
  });

  test("the account command sends exactly what the route reads, including the status on screen", () => {
    assert.match(list, /action\.run\(adminApi\.teacher\(uid\), "PATCH", \{ command, reason: reason \|\| undefined, expectedStatus: status \}\)/);
    const route = readFileSync(routeFileFor(adminApi.teacher("teacher-9")) as string, "utf8");
    assert.deepEqual(bodyKeysOf(route), ["command", "expectedStatus", "reason"]);
    assert.match(list, /if \(status !== "active" && status !== "inactive"\) return null;/, "no account command for applicants");
  });

  test("the state filter offers the queue, everything, and each state the service accepts", async () => {
    assert.match(list, /useState<string>\(AWAITING_DECISION_FILTER\)/, "the queue is the default view");
    assert.match(list, /<option value=\{AWAITING_DECISION_FILTER\}>\{tt\.awaitingDecision\}<\/option>\s*<option value="">\{tt\.allStates\}<\/option>/);
    assert.match(list, /TEACHER_APPLICATION_STATES\.filter\(\(s\) => s !== "draft"\)/);
    for (const state of [AWAITING_DECISION_FILTER, "", ...TEACHER_APPLICATION_STATES.filter((s) => s !== "draft")]) {
      await service(fakeExecutor()).listApplications(admin, { state });
    }
  });

  test("teacher management is in the administration navigation", () => {
    const kit = read("src", "components", "academy", "workspace", "admin", "kit.tsx");
    assert.match(kit, /teachers: "\/academy\/manage\/teachers",/);
    // The nav item may carry presentation extras (an icon); the guarded truth
    // is that the teachers route sits in the administration navigation.
    assert.match(kit, /\{ href: managePages\.teachers, label: text\.nav\.teachers[^}]*\}/);
  });
});

// ---------------------------------------------------------------------------
// Legacy
// ---------------------------------------------------------------------------

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe("legacy teacher approval", () => {
  test("no screen or module calls the retired approval routes", () => {
    const retired = new Set(["src/app/api/admin/approve-teacher/route.ts", "src/app/api/admin/teacher-applications/route.ts"]);
    for (const file of walk(join(ROOT, "src")).filter((path) => /\.(ts|tsx|js|jsx)$/.test(path))) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      if (retired.has(rel)) continue;
      assert.doesNotMatch(readFileSync(file, "utf8"), /\/api\/admin\/(approve-teacher|teacher-applications)\b/, rel);
    }
  });

  test("the legacy verification screen redirects to teacher management; the legacy profile screen links to it", () => {
    const verification = read("src", "app", "dashboard", "admin", "teacher-verification", "page.tsx");
    assert.match(verification, /export default function TeacherVerificationPage\(\) \{\s*redirect\("\/academy\/manage\/teachers"\);\s*\}/);
    assert.doesNotMatch(verification, /"use client"|fetch\(/);
    const profile = read("src", "app", "dashboard", "admin", "user-profile", "page.tsx");
    assert.doesNotMatch(profile, /approveTeacher|Approve Teacher/);
    assert.match(profile, /href="\/academy\/manage\/teachers"/);
    // The legacy administration dashboard (and its teacher tab) is retired: it redirects to the academy
    // administration, whose navigation includes teacher management.
    const dashboard = read("src", "app", "dashboard", "admin", "page.tsx");
    assert.match(dashboard, /redirect\(ADMIN_HOME\)/);
    assert.ok(existsSync(join(ROOT, "src", "app", "academy", "(workspace)", "manage", "teachers", "page.tsx")));
  });

  test("dashboard counts: teachers are active teacher accounts; applications are accounts waiting for a decision", () => {
    const stats = read("src", "app", "api", "admin", "stats", "route.ts");
    assert.match(stats, /FROM profiles WHERE role='teacher' AND status='active'\) AS total_teachers/);
    assert.match(stats, /FROM profiles WHERE role='teacher' AND status='pending'\) AS teacher_applications/);
    assert.doesNotMatch(stats, /FROM teacher_applications/);
  });
});
