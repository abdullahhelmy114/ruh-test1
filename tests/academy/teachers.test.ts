/**
 * Teacher applications, administrator review and teacher account activation.
 *
 * Covered: application validation (identity never taken from the payload),
 * private document ids, the state machine and the commands offered per state,
 * the application → account status mirror; submission, revision after a
 * change request, and every administrator decision as ONE guarded
 * transaction (lock, application at the seen revision and state with its
 * audit event, history event, account status from exactly the expected
 * value); stale screens, double decisions, approve/reject/request-changes
 * races, missing or mismatched profiles, unverified email, missing or
 * disabled sign-in accounts; applicant privacy (no decider, no storage ids);
 * audited document links; deactivation and reactivation.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { AuthUser } from "../../src/lib/auth/core.ts";
import { buildAuditEvent } from "../../src/lib/academy/audit/audit.ts";
import { TEACHER_APPLICATION_MACHINE, TEACHER_APPLICATION_STATES, canTransition, isTerminal } from "../../src/lib/academy/domain/states.ts";
import * as repo from "../../src/lib/academy/repo/teacher-repo.ts";
import { createTeacherService, type DocumentLinks, type IdentityDirectory } from "../../src/lib/academy/services/teacher-service.ts";
import {
  ADMIN_COMMANDS,
  ADMIN_COMMAND_TARGET,
  accountStatusFor,
  adminCommandsFor,
  parseApplicationDetails,
  parseDocumentId,
  planAdminDecision,
  planResubmit,
  planSubmitApplication,
  planTeacherAccountChange,
  type ApplicantAccountFacts,
  type TeacherApplicationRecord,
} from "../../src/lib/academy/teachers/applications.ts";
import {
  admin,
  admin2,
  assertWellFormed,
  expectDomain,
  fakeExecutor,
  fixedClock,
  rejectsDomain,
  rejectsForbidden,
  sequentialIds,
  student,
  teacher,
  type FakeExecutor,
  type Rule,
} from "./support.ts";

const APPLICATION_ID = "a7a7a7a7-0000-4000-8000-000000000001";
const CV = "teacher-signup/cv/0f6d2b1e-8a4c-4f5e-9b7d-3c2a1e0f9d8b.pdf";
const CV2 = "teacher-signup/cv/1f6d2b1e-8a4c-4f5e-9b7d-3c2a1e0f9d8b.pdf";
const VIDEO = "teacher-signup/videos/2f6d2b1e-8a4c-4f5e-9b7d-3c2a1e0f9d8b";

const DETAILS = {
  firstName: "Maryam",
  lastName: "Yusuf",
  countryOfResidence: "TR",
  nationality: "EG",
  gender: "female",
  languages: [{ code: "ar", proficiency: "native" }, { code: "en", proficiency: "advanced" }],
  whatsapp: "+90 555 123 4567",
  telegram: "maryam_teaches",
  bio: "I have taught Arabic grammar and Quranic reading to adult learners for twelve years.",
  socialLinks: [{ platform: "LinkedIn", url: "https://www.linkedin.com/in/maryam" }],
};

const applicant = (status: string | null, uid = "applicant-1"): AuthUser => ({ uid, profileId: `p-${uid}`, role: "applicant", email: null, accountRole: "teacher", accountStatus: status });
const ctx = (user: { uid: string; role: AuthUser["role"] }) => ({ actor: { uid: user.uid, role: user.role }, clock: fixedClock, newId: sequentialIds("e1e1e1e1") });

function application(overrides: Partial<TeacherApplicationRecord> = {}): TeacherApplicationRecord {
  return Object.freeze({
    id: APPLICATION_ID,
    applicantUid: "applicant-1",
    state: "submitted",
    details: parseApplicationDetails(DETAILS),
    cvPublicId: CV,
    introVideoPublicId: null,
    revision: 3,
    submittedAt: "2026-09-10T08:00:00.000Z",
    decidedAt: null,
    decidedBy: null,
    decisionReason: null,
    createdAt: "2026-09-10T08:00:00.000Z",
    updatedAt: "2026-09-10T08:00:00.000Z",
    ...overrides,
  });
}

const FACTS_OK: ApplicantAccountFacts = { profileMatches: true, emailVerified: true, signInAccountUsable: true };

// ---------------------------------------------------------------------------
// Domain
// ---------------------------------------------------------------------------

describe("application details", () => {
  test("valid details are normalised; identity and role fields in the payload are ignored", () => {
    const details = parseApplicationDetails({ ...DETAILS, uid: "admin-1", role: "admin", status: "active", email: "x@example.test" });
    assert.equal(details.telegram, "@maryam_teaches");
    assert.deepEqual(Object.keys(details).sort(), ["bio", "countryOfResidence", "firstName", "gender", "languages", "lastName", "nationality", "socialLinks", "telegram", "whatsapp"]);
    assert.equal(JSON.stringify(details).includes("admin"), false);
  });

  test("every field is validated", () => {
    const bad: [string, unknown][] = [
      ["firstName", ""],
      ["lastName", "x".repeat(81)],
      ["gender", "other"],
      ["languages", []],
      ["languages", [{ code: "ar", proficiency: "advanced" }]],
      ["languages", [{ code: "ar", proficiency: "native" }, { code: "ar", proficiency: "beginner" }]],
      ["languages", [{ code: "<script>", proficiency: "native" }]],
      ["whatsapp", "call me"],
      ["telegram", "no spaces allowed"],
      ["bio", "too short"],
      ["bio", "x".repeat(5001)],
      ["socialLinks", [{ platform: "Site", url: "http://example.test" }]],
      ["socialLinks", [{ platform: "Site", url: "javascript:alert(1)" }]],
      ["socialLinks", Array.from({ length: 11 }, () => ({ platform: "a", url: "https://a.test" }))],
    ];
    for (const [key, value] of bad) {
      expectDomain(() => parseApplicationDetails({ ...DETAILS, [key]: value }), "VALIDATION");
    }
    expectDomain(() => parseApplicationDetails(null), "VALIDATION");
    expectDomain(() => parseApplicationDetails([DETAILS]), "VALIDATION");
  });

  test("private documents are referenced only by the ids the upload boundary issues", () => {
    assert.equal(parseDocumentId("cv", CV), CV);
    assert.equal(parseDocumentId("intro_video", VIDEO), VIDEO);
    for (const value of [
      "https://res.cloudinary.com/x/raw/upload/v1/teacher-signup/cv/0f6d2b1e-8a4c-4f5e-9b7d-3c2a1e0f9d8b.pdf",
      "teacher-signup/cv/../videos/0f6d2b1e-8a4c-4f5e-9b7d-3c2a1e0f9d8b.pdf",
      "teacher-signup/videos/0f6d2b1e-8a4c-4f5e-9b7d-3c2a1e0f9d8b.pdf",
      "other/cv/0f6d2b1e-8a4c-4f5e-9b7d-3c2a1e0f9d8b.pdf",
      VIDEO,
      "",
      null,
    ]) {
      expectDomain(() => parseDocumentId("cv", value), "VALIDATION");
    }
    expectDomain(() => parseDocumentId("intro_video", CV), "VALIDATION");
  });
});

describe("application states and the account status mirror", () => {
  test("approval and rejection are final; only a change request lets the applicant resubmit", () => {
    assert.equal(isTerminal(TEACHER_APPLICATION_MACHINE, "approved"), true);
    assert.equal(isTerminal(TEACHER_APPLICATION_MACHINE, "rejected"), true);
    assert.equal(canTransition(TEACHER_APPLICATION_MACHINE, "changes_requested", "submitted"), true);
    assert.equal(canTransition(TEACHER_APPLICATION_MACHINE, "changes_requested", "approved"), false, "a change request must be answered first");
    assert.equal(canTransition(TEACHER_APPLICATION_MACHINE, "rejected", "submitted"), false);
  });

  test("the commands offered in each state are exactly the allowed transitions", () => {
    for (const state of TEACHER_APPLICATION_STATES) {
      const offered = adminCommandsFor(state);
      for (const command of ADMIN_COMMANDS) {
        assert.equal(offered.includes(command), canTransition(TEACHER_APPLICATION_MACHINE, state, ADMIN_COMMAND_TARGET[command]), `${state} ${command}`);
      }
    }
    assert.deepEqual(adminCommandsFor("approved"), []);
    assert.deepEqual(adminCommandsFor("changes_requested"), ["reject"]);
  });

  test("teaching privileges (status active) belong to approved applications only", () => {
    const mirror = Object.fromEntries(TEACHER_APPLICATION_STATES.map((state) => [state, accountStatusFor(state)]));
    assert.deepEqual(mirror, {
      draft: "pending",
      submitted: "pending",
      in_review: "pending",
      interview: "pending",
      changes_requested: "changes_requested",
      approved: "active",
      rejected: "rejected",
      withdrawn: "withdrawn",
    });
  });
});

describe("submission and revision plans", () => {
  test("a submission is made by the applicant themself and starts as submitted at revision 1", () => {
    const user = applicant("pending");
    const plan = planSubmitApplication({ applicantUid: user.uid, details: DETAILS, cvPublicId: CV, introVideoPublicId: VIDEO }, ctx(user));
    assert.equal(plan.record.state, "submitted");
    assert.equal(plan.record.revision, 1);
    assert.deepEqual(plan.event, { ...plan.event, action: "submit", fromState: null, toState: "submitted", actorRole: "applicant", applicationRevision: 1 });
    assert.deepEqual(plan.account, { uid: user.uid, from: "pending", to: "pending", requireVerifiedEmail: false });
    assert.equal(plan.audit.action, "teacher_application.submit");
    expectDomain(() => planSubmitApplication({ applicantUid: "someone-else", details: DETAILS, cvPublicId: CV }, ctx(user)), "VALIDATION");
    expectDomain(() => planSubmitApplication({ applicantUid: user.uid, details: DETAILS, cvPublicId: null }, ctx(user)), "VALIDATION");
    assert.doesNotThrow(() => buildAuditEvent(plan.audit), "applicant actors are valid audit actors");
  });

  test("only the owner revises, only after a change request, only at the revision they saw; documents are kept unless replaced", () => {
    const current = application({ state: "changes_requested", revision: 4, decisionReason: "Add your ijazah details." });
    const owner = applicant("changes_requested");
    const plan = planResubmit(current, { details: { ...DETAILS, bio: `${DETAILS.bio} I also hold an ijazah in Hafs.` }, expectedRevision: 4 }, ctx(owner));
    assert.equal(plan.record.state, "submitted");
    assert.equal(plan.record.revision, 5);
    assert.equal(plan.record.cvPublicId, CV);
    assert.deepEqual(plan.account, { uid: owner.uid, from: "changes_requested", to: "pending", requireVerifiedEmail: false });
    assert.equal(planResubmit(current, { details: DETAILS, cvPublicId: CV2, expectedRevision: 4 }, ctx(owner)).record.cvPublicId, CV2);

    expectDomain(() => planResubmit(current, { details: DETAILS, expectedRevision: 4 }, ctx(applicant("changes_requested", "applicant-2"))), "NOT_FOUND");
    expectDomain(() => planResubmit(current, { details: DETAILS, expectedRevision: 3 }, ctx(owner)), "CONFLICT");
    expectDomain(() => planResubmit(application({ state: "submitted" }), { details: DETAILS, expectedRevision: 3 }, ctx(owner)), "CONFLICT");
    expectDomain(() => planResubmit(application({ state: "approved" }), { details: DETAILS, expectedRevision: 3 }, ctx(owner)), "CONFLICT");
  });
});

describe("administrator decision plans", () => {
  test("approval moves the account from pending to active and requires a verified email and a usable sign-in account", () => {
    const plan = planAdminDecision(application(), { command: "approve", expectedRevision: 3 }, FACTS_OK, ctx(admin));
    assert.equal(plan.record.state, "approved");
    assert.equal(plan.record.revision, 4);
    assert.equal(plan.record.decidedBy, "admin-1");
    assert.deepEqual(plan.account, { uid: "applicant-1", from: "pending", to: "active", requireVerifiedEmail: true });
    assert.equal(plan.event.applicationRevision, 4);
    for (const facts of [
      { ...FACTS_OK, emailVerified: false },
      { ...FACTS_OK, signInAccountUsable: false },
      { ...FACTS_OK, profileMatches: false },
    ]) {
      expectDomain(() => planAdminDecision(application(), { command: "approve", expectedRevision: 3 }, facts, ctx(admin)), "CONFLICT");
    }
  });

  test("each command moves the account exactly as the mirror says", () => {
    const cases: [TeacherApplicationRecord["state"], string, string | undefined, string, string][] = [
      ["submitted", "start_review", undefined, "pending", "pending"],
      ["in_review", "schedule_interview", undefined, "pending", "pending"],
      ["interview", "request_changes", "Please add a teaching demonstration.", "pending", "changes_requested"],
      ["in_review", "reject", "We are not recruiting for this subject.", "pending", "rejected"],
      ["changes_requested", "reject", "No reply to our request.", "changes_requested", "rejected"],
      ["interview", "approve", undefined, "pending", "active"],
    ];
    for (const [state, command, reason, from, to] of cases) {
      const plan = planAdminDecision(application({ state }), { command, reason, expectedRevision: 3 }, FACTS_OK, ctx(admin));
      assert.deepEqual([plan.account.from, plan.account.to], [from, to], `${state} ${command}`);
      assert.equal(plan.audit.action, `teacher_application.${command}`);
      assert.doesNotThrow(() => buildAuditEvent(plan.audit));
    }
  });

  test("invalid transitions, stale revisions, missing reasons, self-decisions and non-administrators are refused", () => {
    expectDomain(() => planAdminDecision(application({ state: "approved" }), { command: "approve", expectedRevision: 3 }, FACTS_OK, ctx(admin)), "INVALID_TRANSITION");
    expectDomain(() => planAdminDecision(application({ state: "rejected" }), { command: "reject", reason: "again", expectedRevision: 3 }, FACTS_OK, ctx(admin)), "INVALID_TRANSITION");
    expectDomain(() => planAdminDecision(application({ state: "changes_requested" }), { command: "approve", expectedRevision: 3 }, FACTS_OK, ctx(admin)), "INVALID_TRANSITION");
    expectDomain(() => planAdminDecision(application(), { command: "approve", expectedRevision: 2 }, FACTS_OK, ctx(admin)), "CONFLICT");
    expectDomain(() => planAdminDecision(application(), { command: "approve", expectedRevision: "3" }, FACTS_OK, ctx(admin)), "VALIDATION");
    expectDomain(() => planAdminDecision(application(), { command: "reject", expectedRevision: 3 }, FACTS_OK, ctx(admin)), "VALIDATION");
    expectDomain(() => planAdminDecision(application(), { command: "request_changes", reason: "  ", expectedRevision: 3 }, FACTS_OK, ctx(admin)), "VALIDATION");
    expectDomain(() => planAdminDecision(application(), { command: "promote", expectedRevision: 3 }, FACTS_OK, ctx(admin)), "VALIDATION");
    expectDomain(() => planAdminDecision(application({ applicantUid: "admin-1" }), { command: "approve", expectedRevision: 3 }, FACTS_OK, ctx(admin)), "CONFLICT");
    expectDomain(() => planAdminDecision(application(), { command: "approve", expectedRevision: 3 }, FACTS_OK, ctx(teacher)), "VALIDATION");
  });

  test("deactivation needs an active teacher and a reason; reactivation only reverses a deactivation", () => {
    const active = { uid: "teacher-9", role: "teacher", status: "active" };
    const plan = planTeacherAccountChange(active, { command: "deactivate", reason: "Left the academy.", expectedStatus: "active" }, ctx(admin));
    assert.deepEqual(plan.account, { uid: "teacher-9", from: "active", to: "inactive" });
    assert.equal(plan.audit.action, "teacher.deactivate");
    expectDomain(() => planTeacherAccountChange(active, { command: "deactivate", expectedStatus: "active" }, ctx(admin)), "VALIDATION");
    expectDomain(() => planTeacherAccountChange(active, { command: "deactivate", reason: "x", expectedStatus: "pending" }, ctx(admin)), "CONFLICT");
    expectDomain(() => planTeacherAccountChange(active, { command: "reactivate", expectedStatus: "active" }, ctx(admin)), "CONFLICT");
    for (const status of ["pending", "changes_requested", "rejected", null]) {
      expectDomain(() => planTeacherAccountChange({ ...active, status }, { command: "reactivate", expectedStatus: status }, ctx(admin)), "CONFLICT");
    }
    assert.deepEqual(planTeacherAccountChange({ ...active, status: "inactive" }, { command: "reactivate", expectedStatus: "inactive" }, ctx(admin)).account, { uid: "teacher-9", from: "inactive", to: "active" });
    expectDomain(() => planTeacherAccountChange({ ...active, role: "student" }, { command: "deactivate", reason: "x", expectedStatus: "active" }, ctx(admin)), "NOT_FOUND");
    expectDomain(() => planTeacherAccountChange({ ...active, uid: "admin-1" }, { command: "deactivate", reason: "x", expectedStatus: "active" }, ctx(admin)), "CONFLICT");
  });
});

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

describe("teacher repository", () => {
  test("queries are well formed", () => {
    const record = application();
    for (const query of [
      repo.selectApplicationQuery(APPLICATION_ID),
      repo.selectApplicationForApplicantQuery("applicant-1"),
      repo.listApplicationsQuery({ states: ["submitted", "in_review"] }),
      repo.listApplicationsQuery({ states: null }),
      repo.lockApplicationQuery(APPLICATION_ID),
      repo.insertApplicationQuery(record),
      repo.updateApplicationQuery(record, { revision: 3, state: "submitted" }),
      repo.listApplicationEventsQuery(APPLICATION_ID),
      repo.transitionAccountQuery({ uid: "applicant-1", from: "pending", to: "active", requireVerifiedEmail: true }),
      repo.setTeacherAccountStatusQuery({ uid: "teacher-9", from: "active", to: "inactive" }),
      repo.updateTeacherDisplayFieldsQuery("applicant-1", record.details),
      repo.selectTeacherAccountQuery("teacher-9"),
      repo.listTeacherAccountsQuery({ activeOnly: true }),
    ]) {
      assertWellFormed(query);
      assert.equal(query.text.includes("applicant-1"), false, "identifiers are parameters");
    }
  });

  test("account writes match only a teacher account at exactly the expected status (and a verified email for approval)", () => {
    const approve = repo.transitionAccountQuery({ uid: "u", from: "pending", to: "active", requireVerifiedEmail: true });
    assert.match(approve.text, /UPDATE profiles SET status = \$1\s+WHERE firebase_uid = \$2 AND role = 'teacher'/);
    assert.match(approve.text, /AND \(status = \$3 OR \(\$4::boolean AND status IS NULL\)\)/);
    assert.match(approve.text, /AND \(NOT \$5::boolean OR email_verified = TRUE\)/);
    assert.deepEqual(approve.values, ["active", "u", "pending", false, true]);
    assert.match(repo.updateApplicationQuery(application(), { revision: 3, state: "submitted" }).text, /WHERE id = \$\d+::uuid AND revision = \$\d+ AND state = \$\d+\s+RETURNING id/);
    assert.match(repo.setTeacherAccountStatusQuery({ uid: "u", from: "active", to: "inactive" }).text, /WHERE firebase_uid = \$2 AND role = 'teacher' AND status = \$3/);
  });

  test("stored details that no longer validate are treated as corruption, not as user input", () => {
    const row = { ...rowOf(application()), details: JSON.stringify({ firstName: "x" }) };
    assert.throws(() => repo.mapApplicationRow(row), (error: unknown) => error instanceof Error && error.message === "Stored teacher application details are not valid.");
  });
});

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

function rowOf(record: TeacherApplicationRecord): Record<string, unknown> {
  return {
    id: record.id, applicant_uid: record.applicantUid, state: record.state, details: record.details, cv_public_id: record.cvPublicId,
    intro_video_public_id: record.introVideoPublicId, revision: record.revision, submitted_at: record.submittedAt, decided_at: record.decidedAt,
    decided_by: record.decidedBy, decision_reason: record.decisionReason, created_at: record.createdAt, updated_at: record.updatedAt,
  };
}

const R = {
  applicationById: /FROM academy_teacher_applications a WHERE a\.id = \$1::uuid$/,
  applicationForApplicant: /FROM academy_teacher_applications a WHERE a\.applicant_uid = \$1/,
  account: /FROM profiles WHERE firebase_uid = \$1$/,
  events: /FROM academy_teacher_application_events ev/,
  teachers: /WHERE p\.role = 'teacher' AND/,
};

type World = Partial<Record<keyof typeof R, Rule["rows"]>>;

function world(overrides: World = {}): Rule[] {
  const rows: Record<string, Rule["rows"]> = {
    applicationById: [rowOf(application())],
    applicationForApplicant: [],
    account: [{ firebase_uid: "applicant-1", role: "teacher", status: "pending", email: "maryam@example.test", email_verified: true, full_name: "Maryam Yusuf" }],
    events: [],
    teachers: [],
    ...overrides,
  };
  return (Object.keys(R) as (keyof typeof R)[]).map((key) => ({ match: R[key], rows: rows[key] }));
}

function identity(state: { exists: boolean; disabled: boolean; emailVerified: boolean } = { exists: true, disabled: false, emailVerified: true }) {
  const calls: string[] = [];
  const directory: IdentityDirectory & { calls: string[] } = {
    calls,
    async signInAccount(uid) {
      calls.push(uid);
      return state;
    },
  };
  return directory;
}

const documents: DocumentLinks = {
  temporaryLink: (kind, storageId) => ({ url: `https://files.example.test/${kind}/${encodeURIComponent(storageId)}?expires=300`, expiresAt: "2026-09-17T12:05:00.000Z" }),
};

function service(executor: FakeExecutor, dir = identity(), ready = true) {
  return createTeacherService({ executor, flags: { coreSchemaReady: ready }, clock: fixedClock, newId: sequentialIds("f1f1f1f1"), identity: dir, documents });
}

describe("teacher service: applicants", () => {
  test("only teacher accounts have an application page; students and administrators are refused", async () => {
    for (const user of [student, admin, teacher]) {
      const executor = fakeExecutor(world());
      await rejectsForbidden(service(executor).myApplication(user));
      await rejectsForbidden(service(executor).submitApplication(user, { details: DETAILS, cvPublicId: CV }));
      assert.equal(executor.queries.length + executor.transactions.length, 0);
    }
  });

  test("the applicant sees their state and the note for changes or rejection, never who decided or storage ids", async () => {
    const decided = application({ state: "changes_requested", decidedAt: "2026-09-12T10:00:00.000Z", decidedBy: "admin-1", decisionReason: "Add your ijazah details.", introVideoPublicId: VIDEO });
    const view = await service(fakeExecutor(world({ applicationForApplicant: [rowOf(decided)] }))).myApplication(applicant("changes_requested"));
    assert.equal(view.application?.state, "changes_requested");
    assert.equal(view.application?.note, "Add your ijazah details.");
    assert.equal(view.canRevise, true);
    assert.equal(view.canSubmit, false);
    const json = JSON.stringify(view);
    for (const secret of ["admin-1", CV, VIDEO, "decidedBy"]) assert.equal(json.includes(secret), false, secret);
    const pending = await service(fakeExecutor(world({ applicationForApplicant: [rowOf(application({ decisionReason: "internal" }))] }))).myApplication(applicant("pending"));
    assert.equal(pending.application?.note, null, "no note while under review");
  });

  test("an existing teacher account without an application submits once, in one transaction with the account and display fields", async () => {
    const executor = fakeExecutor(world());
    const view = await service(executor).submitApplication(applicant(null), { details: DETAILS, cvPublicId: CV });
    assert.equal(view.state, "submitted");
    const [insert, event, account, display] = executor.transactions[0];
    assert.match(insert.text, /^WITH mutated AS \(INSERT INTO academy_teacher_applications[\s\S]*academy_audit_events/);
    assert.match(event.text, /INSERT INTO academy_teacher_application_events[\s\S]*academy_expect_rows/);
    assert.match(account.text, /UPDATE profiles SET status = \$1[\s\S]*academy_expect_rows/);
    assert.ok(account.values.includes(true), "a legacy account without a status is accepted as pending");
    assert.match(display.text, /UPDATE profiles SET\s+full_name = /);

    for (const status of ["active", "rejected", "changes_requested"]) {
      const refused = fakeExecutor(world());
      await rejectsDomain(service(refused).submitApplication(applicant(status), { details: DETAILS, cvPublicId: CV }), "CONFLICT");
      assert.equal(refused.transactions.length, 0, status);
    }
    const existing = fakeExecutor(world({ applicationForApplicant: [rowOf(application())] }));
    await rejectsDomain(service(existing).submitApplication(applicant("pending"), { details: DETAILS, cvPublicId: CV }), "CONFLICT");
    assert.equal(existing.transactions.length, 0);
    const raced = fakeExecutor(world());
    raced.failTransactionWith = Object.assign(new Error("duplicate key"), { code: "23505" });
    await assert.rejects(service(raced).submitApplication(applicant("pending"), { details: DETAILS, cvPublicId: CV }), /already an application/);
  });

  test("resubmission locks the application and moves it and the account together", async () => {
    const current = application({ state: "changes_requested", revision: 4 });
    const executor = fakeExecutor(world({ applicationForApplicant: [rowOf(current)] }));
    await service(executor).resubmitApplication(applicant("changes_requested"), { details: DETAILS, expectedRevision: 4 });
    const [lock, update, event, account] = executor.transactions[0];
    assert.match(lock.text, /FOR UPDATE$/);
    assert.match(update.text, /WHERE id = \$(\d+)::uuid AND revision = \$(\d+) AND state = \$(\d+)/);
    const [, idAt, revisionAt, stateAt] = /WHERE id = \$(\d+)::uuid AND revision = \$(\d+) AND state = \$(\d+)/.exec(update.text) ?? [];
    assert.deepEqual([update.values[Number(idAt) - 1], update.values[Number(revisionAt) - 1], update.values[Number(stateAt) - 1]], [APPLICATION_ID, 4, "changes_requested"], "guarded on the revision and state the applicant saw");
    assert.match(event.text, /INSERT INTO academy_teacher_application_events/);
    assert.deepEqual(account.values.slice(0, 3), ["pending", "applicant-1", "changes_requested"]);
  });

  test("nothing is available before the academy schema exists", async () => {
    const executor = fakeExecutor(world());
    await rejectsDomain(service(executor, identity(), false).myApplication(applicant("pending")), "FEATURE_UNAVAILABLE");
    await rejectsDomain(service(executor, identity(), false).decide(admin, APPLICATION_ID, { command: "approve", expectedRevision: 3 }), "FEATURE_UNAVAILABLE");
    assert.equal(executor.queries.length, 0);
  });
});

describe("teacher service: administrator decisions", () => {
  test("only administrators review; teachers, students and applicants are refused before any read", async () => {
    for (const user of [teacher, student, applicant("pending")]) {
      const executor = fakeExecutor(world());
      const svc = service(executor);
      await rejectsForbidden(svc.listApplications(user));
      await rejectsForbidden(svc.getApplication(user, APPLICATION_ID));
      await rejectsForbidden(svc.decide(user, APPLICATION_ID, { command: "approve", expectedRevision: 3 }));
      await rejectsForbidden(svc.openDocument(user, APPLICATION_ID, "cv"));
      await rejectsForbidden(svc.listTeachers(user));
      await rejectsForbidden(svc.changeTeacherAccount(user, "teacher-9", { command: "deactivate", reason: "x", expectedStatus: "active" }));
      assert.equal(executor.queries.length + executor.transactions.length, 0);
    }
  });

  test("approval is one transaction: lock, application at the seen revision and state with audit, history event, account pending → active with a verified email", async () => {
    const dir = identity();
    const executor = fakeExecutor(world());
    const result = await service(executor, dir).decide(admin, APPLICATION_ID, { command: "approve", expectedRevision: 3 });
    assert.deepEqual(result, { id: APPLICATION_ID, state: "approved", revision: 4, accountStatus: "active" });
    assert.equal(executor.transactions.length, 1);
    const [lock, update, event, account] = executor.transactions[0];
    assert.equal(lock.text, "SELECT id FROM academy_teacher_applications WHERE id = $1::uuid FOR UPDATE");
    assert.match(update.text, /^WITH mutated AS \(UPDATE academy_teacher_applications SET[\s\S]*WHERE id = \$\d+::uuid AND revision = \$\d+ AND state = \$\d+[\s\S]*academy_audit_events[\s\S]*academy_expect_rows/);
    assert.ok(update.values.includes("teacher_application.approve"));
    assert.match(event.text, /INSERT INTO academy_teacher_application_events[\s\S]*academy_expect_rows/);
    assert.ok(event.values.includes("approve") && event.values.includes(4));
    assert.match(account.text, /UPDATE profiles SET status = \$1[\s\S]*email_verified = TRUE[\s\S]*academy_expect_rows\(\(SELECT count\(\*\) FROM mutated\), \$\d+::bigint\)/);
    assert.deepEqual(account.values, ["active", "applicant-1", "pending", false, true, 1]);
    assert.deepEqual(dir.calls, ["applicant-1"]);
  });

  test("a stale screen, a repeated decision or a decided application never reaches the database", async () => {
    const stale = fakeExecutor(world());
    await rejectsDomain(service(stale).decide(admin, APPLICATION_ID, { command: "approve", expectedRevision: 2 }), "CONFLICT");
    assert.equal(stale.transactions.length, 0);
    for (const state of ["approved", "rejected"] as const) {
      const decided = fakeExecutor(world({ applicationById: [rowOf(application({ state, decidedAt: "2026-09-12T10:00:00Z", decidedBy: "admin-2" }))], account: [{ firebase_uid: "applicant-1", role: "teacher", status: accountStatusFor(state), email: null, email_verified: true }] }));
      for (const command of ["approve", "reject", "request_changes"]) {
        await rejectsDomain(service(decided).decide(admin, APPLICATION_ID, { command, reason: "again", expectedRevision: 3 }), "INVALID_TRANSITION");
      }
      assert.equal(decided.transactions.length, 0, state);
    }
  });

  test("two administrators deciding the same revision: the second transaction aborts and nothing partial remains", async () => {
    // Both loaded revision 3. The database applies the first; the second's guarded writes match nothing.
    for (const [first, second] of [["approve", "approve"], ["approve", "reject"], ["reject", "approve"], ["approve", "request_changes"], ["request_changes", "approve"]]) {
      const winner = fakeExecutor(world());
      await service(winner).decide(admin, APPLICATION_ID, { command: first, reason: "Reason given.", expectedRevision: 3 });
      assert.equal(winner.transactions.length, 1);

      const loser = fakeExecutor(world());
      loser.failTransactionWith = Object.assign(new Error("academy stale write: expected 1 row(s), matched 0"), { code: "RQ409" });
      await rejectsDomain(service(loser).decide(admin2, APPLICATION_ID, { command: second, reason: "Reason given.", expectedRevision: 3 }), "CONFLICT");

      const racedEvent = fakeExecutor(world());
      racedEvent.failTransactionWith = Object.assign(new Error("duplicate key academy_teacher_application_events_revision_uq"), { code: "23505" });
      await assert.rejects(service(racedEvent).decide(admin2, APPLICATION_ID, { command: second, reason: "Reason given.", expectedRevision: 3 }), /decided by someone else/);
    }
  });

  test("approval is refused before writing when the email is unverified, the profile does not match, or the sign-in account is unusable", async () => {
    const cases: [World, ReturnType<typeof identity>][] = [
      [{ account: [{ firebase_uid: "applicant-1", role: "teacher", status: "pending", email: null, email_verified: false }] }, identity()],
      [{ account: [] }, identity()],
      [{ account: [{ firebase_uid: "applicant-1", role: "student", status: "pending", email: null, email_verified: true }] }, identity()],
      [{ account: [{ firebase_uid: "applicant-1", role: "teacher", status: "active", email: null, email_verified: true }] }, identity()],
      [{ account: [{ firebase_uid: "applicant-1", role: "teacher", status: "rejected", email: null, email_verified: true }] }, identity()],
      [{}, identity({ exists: false, disabled: false, emailVerified: false })],
      [{}, identity({ exists: true, disabled: true, emailVerified: true })],
    ];
    for (const [overrides, dir] of cases) {
      const executor = fakeExecutor(world(overrides));
      await rejectsDomain(service(executor, dir).decide(admin, APPLICATION_ID, { command: "approve", expectedRevision: 3 }), "CONFLICT");
      assert.equal(executor.transactions.length, 0, JSON.stringify(overrides));
    }
  });

  test("other decisions do not consult the identity provider and keep the account out of teaching", async () => {
    const dir = identity();
    const executor = fakeExecutor(world());
    const result = await service(executor, dir).decide(admin, APPLICATION_ID, { command: "request_changes", reason: "Add a teaching demonstration.", expectedRevision: 3 });
    assert.equal(result.accountStatus, "changes_requested");
    assert.deepEqual(dir.calls, []);
    const account = executor.transactions[0][3];
    assert.deepEqual(account.values.slice(0, 5), ["changes_requested", "applicant-1", "pending", false, false]);
  });

  test("the review page shows the account facts and history but no storage ids; an unreachable provider does not hide it", async () => {
    const events = [{ id: "ev1", application_id: APPLICATION_ID, action: "submit", from_state: null, to_state: "submitted", reason: null, actor_uid: "applicant-1", actor_role: "applicant", application_revision: 1, occurred_at: "2026-09-10T08:00:00Z", actor_name: "Maryam Yusuf" }];
    const failing: IdentityDirectory = { signInAccount: async () => { throw new Error("network"); } };
    const detail = await service(fakeExecutor(world({ events })), failing as ReturnType<typeof identity>).getApplication(admin, APPLICATION_ID);
    assert.equal(detail.account.signInAccountExists, null);
    assert.equal(detail.account.expectedStatus, "pending");
    assert.deepEqual(detail.commands, ["start_review", "request_changes", "approve", "reject"]);
    assert.equal(detail.history[0].actorName, "Maryam Yusuf");
    const json = JSON.stringify(detail);
    assert.equal(json.includes(CV), false);
    assert.equal(detail.application.hasCv, true);
  });

  test("documents open through a short-lived link, and every opening is audited", async () => {
    const executor = fakeExecutor(world());
    const link = await service(executor).openDocument(admin, APPLICATION_ID, "cv");
    assert.match(link.url, /^https:\/\/files\.example\.test\/cv\//);
    const [audit] = executor.transactions[0];
    assert.match(audit.text, /INSERT INTO academy_audit_events[\s\S]*academy_expect_rows/);
    assert.ok(audit.values.includes("teacher_application.open_document"));
    await rejectsDomain(service(fakeExecutor(world())).openDocument(admin, APPLICATION_ID, "intro_video"), "NOT_FOUND");
    await rejectsDomain(service(fakeExecutor(world())).openDocument(admin, APPLICATION_ID, "passport"), "NOT_FOUND");
    const unavailable = createTeacherService({ executor: fakeExecutor(world()), flags: { coreSchemaReady: true }, identity: identity(), documents: { temporaryLink: () => null } });
    await rejectsDomain(unavailable.openDocument(admin, APPLICATION_ID, "cv"), "FEATURE_UNAVAILABLE");
  });

  test("deactivating a teacher is a guarded status change with its audit; a stale screen is refused", async () => {
    const account = [{ firebase_uid: "teacher-9", role: "teacher", status: "active", email: null, email_verified: true }];
    const executor = fakeExecutor(world({ account }));
    assert.deepEqual(await service(executor).changeTeacherAccount(admin, "teacher-9", { command: "deactivate", reason: "Left the academy.", expectedStatus: "active" }), { uid: "teacher-9", status: "inactive" });
    const [write] = executor.transactions[0];
    assert.match(write.text, /UPDATE profiles SET status = \$1\s+WHERE firebase_uid = \$2 AND role = 'teacher' AND status = \$3[\s\S]*academy_audit_events/);
    await rejectsDomain(service(fakeExecutor(world({ account }))).changeTeacherAccount(admin, "teacher-9", { command: "deactivate", reason: "x", expectedStatus: "inactive" }), "CONFLICT");
    await rejectsDomain(service(fakeExecutor(world({ account: [] }))).changeTeacherAccount(admin, "teacher-9", { command: "deactivate", reason: "x", expectedStatus: "active" }), "NOT_FOUND");
  });
});
