/**
 * Recordings and certificates.
 *
 * Required invariants covered here: learners watch only published
 * recordings of their own class group, within the course policy and its
 * availability window, and never learn that unpublished recordings exist;
 * only administrators manage recordings and issue or revoke certificates;
 * certificates follow the eligibility policy (fails closed), use
 * unguessable codes, snapshot the name and course, and verify publicly as
 * valid, revoked or not found without exposing identifiers; a completion
 * with an issued certificate cannot be revoked silently.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { AuthUser } from "../../src/lib/auth/core.ts";
import { buildAuditEvent } from "../../src/lib/academy/audit/audit.ts";
import {
  evaluateCertificateEligibility,
  generateCertificateCode,
  normaliseCertificateCode,
  planIssueCertificate,
  planRevokeCertificate,
  verificationResult,
} from "../../src/lib/academy/certificates/certificates.ts";
import type { RelationshipFacts } from "../../src/lib/academy/permissions/permissions.ts";
import { learnerWatchDecision, planCreateRecording, planRecordingStatus, recordingView, type RecordingRecord } from "../../src/lib/academy/recordings/recordings.ts";
import { mapEnrollmentRow, mapSessionRow } from "../../src/lib/academy/repo/delivery-repo.ts";
import * as repo from "../../src/lib/academy/repo/recording-certificate-repo.ts";
import { createCertificateService } from "../../src/lib/academy/services/certificate-service.ts";
import { createProgressService } from "../../src/lib/academy/services/progress-service.ts";
import { createRecordingService } from "../../src/lib/academy/services/recording-service.ts";
import {
  IDS,
  admin,
  assertWellFormed,
  classGroupRow,
  courseRow,
  enrollmentRow,
  expectDomain,
  fakeExecutor,
  fixedClock,
  rejectsDomain,
  rejectsForbidden,
  sequentialIds,
  sessionRow,
  student,
  teacher,
  type FakeExecutor,
  type Rule,
} from "./support.ts";

const outsider: AuthUser = { uid: "student-2", profileId: "p-s2", role: "student", email: "s2@example.test" };
const RECORDING = "7e000000-0000-4000-8000-000000000001";
const COMPLETION = "c5000000-0000-4000-8000-000000000001";
const adminCtx = { actor: { uid: "admin-1", role: "admin" as const }, clock: fixedClock, newId: sequentialIds("8a8a8a8a") };

const OPEN_POLICY = { learnerAccess: "enrolled_learners" as const, availableForDays: 30, downloadAllowed: false };

function recording(overrides: Partial<RecordingRecord> = {}): RecordingRecord {
  return {
    id: RECORDING, sessionId: IDS.session, classGroupId: IDS.classGroup, courseId: IDS.course, title: "Lesson 3 recording",
    mediaUrl: "https://video.example.test/lesson-3", durationSeconds: 3600, state: "published", stateReason: null,
    publishedAt: "2026-10-06T00:00:00.000Z", revision: 3, createdBy: "admin-1", createdAt: "2026-10-05T18:00:00.000Z",
    updatedBy: "admin-1", updatedAt: "2026-10-06T00:00:00.000Z", ...overrides,
  };
}

describe("recording lifecycle", () => {
  test("recordings belong to sessions that took place and need an https link", () => {
    expectDomain(() => planCreateRecording({ session: mapSessionRow(sessionRow()), courseId: IDS.course, title: "x", mediaUrl: "https://v.example.test/x" }, adminCtx), "CONFLICT");
    const done = mapSessionRow(sessionRow({ state: "completed" }));
    expectDomain(() => planCreateRecording({ session: done, courseId: IDS.course, title: "x", mediaUrl: "http://v.example.test/x" }, adminCtx), "VALIDATION");
    const plan = planCreateRecording({ session: done, courseId: IDS.course, title: "Lesson 3", mediaUrl: "https://v.example.test/x" }, adminCtx);
    assert.equal(plan.record.state, "processing");
    assert.doesNotThrow(() => buildAuditEvent(plan.audit));
  });

  test("publication goes through review; restriction and archiving need reasons; availability counts from first publication", () => {
    const processing = recording({ state: "processing", publishedAt: null, revision: 1 });
    expectDomain(() => planRecordingStatus(processing, { to: "published", expectedRevision: 1 }, adminCtx), "INVALID_TRANSITION");
    const review = planRecordingStatus(processing, { to: "in_review", expectedRevision: 1 }, adminCtx).record;
    const published = planRecordingStatus(review, { to: "published", expectedRevision: 2 }, adminCtx).record;
    assert.equal(published.publishedAt, "2026-09-17T12:00:00.000Z");
    expectDomain(() => planRecordingStatus(published, { to: "restricted", expectedRevision: 3 }, adminCtx), "VALIDATION");
    const restricted = planRecordingStatus(published, { to: "restricted", reason: "Consent withdrawn by a learner", expectedRevision: 3 }, adminCtx).record;
    const again = planRecordingStatus(restricted, { to: "published", expectedRevision: 4 }, { ...adminCtx, clock: () => new Date("2026-12-01T00:00:00Z") }).record;
    assert.equal(again.publishedAt, published.publishedAt);
  });
});

describe("watching recordings", () => {
  const at = new Date("2026-10-20T00:00:00.000Z");

  test("learners watch only published recordings, when policy and window allow", () => {
    assert.deepEqual(learnerWatchDecision(recording({ state: "in_review" }), OPEN_POLICY, at), { allowed: false, reason: "not_published" });
    assert.deepEqual(learnerWatchDecision(recording(), { learnerAccess: "none", availableForDays: null, downloadAllowed: false }, at), { allowed: false, reason: "no_learner_access" });
    assert.deepEqual(learnerWatchDecision(recording(), OPEN_POLICY, at), { allowed: true, downloadAllowed: false, availableUntil: "2026-11-05T00:00:00.000Z" });
    assert.deepEqual(learnerWatchDecision(recording(), OPEN_POLICY, new Date("2026-11-05T00:00:00.001Z")), { allowed: false, reason: "expired" });
    assert.deepEqual(learnerWatchDecision(recording(), { ...OPEN_POLICY, availableForDays: null, downloadAllowed: true }, new Date("2030-01-01")), { allowed: true, downloadAllowed: true, availableUntil: null });
  });

  test("the media link appears only when watching is allowed", () => {
    assert.equal(recordingView(recording(), { allowed: false, reason: "expired" }).mediaUrl, null);
    assert.equal(recordingView(recording(), { allowed: true, downloadAllowed: false, availableUntil: null }).mediaUrl, recording().mediaUrl);
    const staff = recordingView(recording({ state: "in_review" }), { staff: true });
    assert.equal(staff.state, "in_review");
    assert.equal(staff.mediaUrl, recording().mediaUrl);
  });
});

describe("certificate codes and eligibility", () => {
  test("codes are random, unambiguous and normalise from what people type", () => {
    const fixed = generateCertificateCode(() => new Uint8Array([0, 1, 2, 3, 30, 31, 32, 33, 60, 61, 62, 63]));
    assert.equal(fixed, "RQ-0123-YZ01-WXYZ");
    const secure = new Set(Array.from({ length: 50 }, () => generateCertificateCode()));
    assert.equal(secure.size, 50);
    for (const code of secure) assert.match(code, /^RQ-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    assert.equal(normaliseCertificateCode(" rq 0123 yz0l wxyz "), "RQ-0123-YZ01-WXYZ");
    assert.equal(normaliseCertificateCode("RQ-O123-YZ01-WXYZ"), "RQ-0123-YZ01-WXYZ");
    for (const bad of ["", "RQ-0123-YZ01", "XX-0123-YZ01-WXYZ", "RQ-0123-YZ01-WXYU", "RQ-0123-YZ01-WXYZ'; DROP", 42]) {
      assert.equal(normaliseCertificateCode(bad), null, String(bad));
    }
  });

  const completion = {
    id: COMPLETION, enrollmentId: IDS.enrollment, classGroupId: IDS.classGroup, courseId: IDS.course, learnerUid: "student-1",
    completedAt: "2026-12-20T00:00:00.000Z", decidedBy: "admin-1", metAllCriteria: true,
    criteriaSnapshot: { criteria: { requireAllLessonsCompleted: true, minimumAttendedRatio: null, requiredAssessmentModes: [], minimumAssessmentScorePercent: null }, evaluation: { eligible: true, checks: [] } },
    overrideReason: null, revokedAt: null, revokedBy: null, revokeReason: null,
  };

  test("eligibility follows the course policy", () => {
    const policy = { certificateOffered: true, requiresCompletion: true, minimumFinalScorePercent: 70 };
    assert.equal(evaluateCertificateEligibility({ policy, completion, bestFinalScorePercent: 82 }).eligible, true);
    assert.equal(evaluateCertificateEligibility({ policy: { ...policy, certificateOffered: false }, completion, bestFinalScorePercent: 82 }).eligible, false);
    assert.equal(evaluateCertificateEligibility({ policy, completion: null, bestFinalScorePercent: 82 }).eligible, false);
    assert.equal(evaluateCertificateEligibility({ policy, completion: { ...completion, revokedAt: "2027-01-01T00:00:00Z" }, bestFinalScorePercent: 82 }).eligible, false);
    assert.equal(evaluateCertificateEligibility({ policy, completion, bestFinalScorePercent: 69 }).eligible, false);
    assert.equal(evaluateCertificateEligibility({ policy, completion, bestFinalScorePercent: null }).eligible, false);
    assert.equal(evaluateCertificateEligibility({ policy: { ...policy, requiresCompletion: false, minimumFinalScorePercent: null }, completion: null, bestFinalScorePercent: null }).eligible, true);
  });

  test("issuance needs eligibility, a name, and no issued certificate; revocation needs a reason", () => {
    const enrollment = mapEnrollmentRow(enrollmentRow({ state: "completed" }));
    const eligible = { eligible: true, checks: [] };
    const base = { enrollment, completion, eligibility: eligible, learnerName: "  Amina Yusuf ", courseTitle: "Nahw 1", existing: [], randomBytes: () => new Uint8Array(12) };
    expectDomain(() => planIssueCertificate({ ...base, eligibility: { eligible: false, checks: [] } }, adminCtx), "CONFLICT");
    expectDomain(() => planIssueCertificate({ ...base, learnerName: " " }, adminCtx), "CONFLICT");
    const issued = planIssueCertificate(base, adminCtx);
    assert.equal(issued.record.learnerNameSnapshot, "Amina Yusuf");
    assert.equal(issued.record.courseTitleSnapshot, "Nahw 1");
    assert.doesNotThrow(() => buildAuditEvent(issued.audit));
    expectDomain(() => planIssueCertificate({ ...base, existing: [issued.record] }, adminCtx), "CONFLICT");
    expectDomain(() => planRevokeCertificate(issued.record, { reason: "" }, adminCtx), "VALIDATION");
    const revoked = planRevokeCertificate(issued.record, { reason: "Issued to the wrong enrollment" }, adminCtx).record;
    expectDomain(() => planRevokeCertificate(revoked, { reason: "again" }, adminCtx), "CONFLICT");
    assert.equal(verificationResult(revoked).status, "revoked");
    assert.equal(verificationResult(issued.record).status, "valid");
    assert.deepEqual(verificationResult(null), { status: "not_found" });
  });

  test("queries are well formed", () => {
    for (const query of [
      repo.selectCertificateByCodeQuery("RQ-0123-YZ01-WXYZ"),
      repo.listLearnerCertificatesQuery("student-1"),
      repo.selectBestFinalScoreQuery(IDS.classGroup, "student-1"),
      repo.listClassGroupRecordingsQuery(IDS.classGroup),
      repo.insertRecordingQuery(recording({ state: "processing", publishedAt: null })),
    ]) {
      assertWellFormed(query);
    }
    assert.match(repo.selectBestFinalScoreQuery(IDS.classGroup, "student-1").text, /x\.mode = 'final'[\s\S]*a\.released_at IS NOT NULL/);
    assert.match(repo.insertRecordingQuery(recording()).text, /s\.state IN \('live', 'completed'\)/);
  });
});

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

const facts: RelationshipFacts = {
  async isTeacherOfClassGroup(uid, groupId) {
    return uid === "teacher-1" && groupId === IDS.classGroup;
  },
  async isActiveLearnerOfClassGroup(uid, groupId) {
    return uid === "student-1" && groupId === IDS.classGroup;
  },
  async classGroupBelongsToCourse(groupId, courseId) {
    return groupId === IDS.classGroup && courseId === IDS.course;
  },
  async hasCourseAccess(uid, courseId) {
    return uid === "student-1" && courseId === IDS.course;
  },
  async hasActiveTeachingRelationship() {
    return false;
  },
};

function recordingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: RECORDING, session_id: IDS.session, class_group_id: IDS.classGroup, course_id: IDS.course, title: "Lesson 3 recording",
    media_url: "https://video.example.test/lesson-3", duration_seconds: 3600, state: "published", state_reason: null,
    published_at: "2026-10-06T00:00:00.000Z", revision: 3, created_by: "admin-1", created_at: "2026-10-05T18:00:00.000Z",
    updated_by: "admin-1", updated_at: "2026-10-06T00:00:00.000Z", ...overrides,
  };
}

function policies(values: Record<string, unknown>) {
  return (q: { values: readonly unknown[] }) => {
    const key = String(q.values[0]);
    return key in values
      ? [{ id: "72000000-0000-4000-8000-000000000001", policy_key: key, scope: "academy", program_id: null, course_id: null, value: JSON.stringify(values[key]), revision: 1, set_by: "admin-1", set_at: "2026-09-01T00:00:00Z", reason: "Rule" }]
      : [];
  };
}

const R = {
  classGroup: /FROM academy_class_groups WHERE id = \$1::uuid$/,
  course: /FROM academy_courses WHERE id = \$1::uuid$/,
  policy: /FROM academy_policy_values/,
  recordings: /FROM academy_recordings WHERE class_group_id/,
  recording: /FROM academy_recordings WHERE id = \$1::uuid$/,
  enrollment: /FROM academy_enrollments WHERE id = \$1::uuid$/,
  completionByEnrollment: /FROM academy_completions WHERE enrollment_id/,
  completion: /FROM academy_completions WHERE id = \$1::uuid$/,
  bestFinal: /max\(a\.score_percent\)/,
  enrollmentCertificates: /FROM academy_certificates WHERE enrollment_id/,
  certificateByCode: /FROM academy_certificates WHERE code = \$1$/,
  learnerCertificates: /FROM academy_certificates WHERE learner_uid/,
  issuedForCompletion: /count\(\*\) AS n FROM academy_certificates/,
  profileName: /SELECT full_name FROM profiles/,
};

const COMPLETION_ROW = {
  id: COMPLETION, enrollment_id: IDS.enrollment, class_group_id: IDS.classGroup, course_id: IDS.course, learner_uid: "student-1",
  completed_at: "2026-12-20T00:00:00Z", decided_by: "admin-1", met_all_criteria: true,
  criteria_snapshot: JSON.stringify({ criteria: {}, evaluation: { eligible: true, checks: [] } }), override_reason: null, revoked_at: null, revoked_by: null, revoke_reason: null,
};

function world(overrides: Partial<Record<keyof typeof R, Rule["rows"]>> = {}): Rule[] {
  const rows: Record<string, Rule["rows"]> = {
    classGroup: [classGroupRow()],
    course: [courseRow()],
    policy: policies({ "recordings.access": OPEN_POLICY, "certificate.eligibility": { certificateOffered: true, requiresCompletion: true, minimumFinalScorePercent: null } }),
    recordings: [recordingRow(), recordingRow({ id: "7e000000-0000-4000-8000-000000000002", state: "processing", published_at: null }), recordingRow({ id: "7e000000-0000-4000-8000-000000000003", state: "restricted" })],
    recording: [recordingRow()],
    enrollment: [enrollmentRow({ state: "completed" })],
    completionByEnrollment: [COMPLETION_ROW],
    completion: [COMPLETION_ROW],
    bestFinal: [{ best: null }],
    enrollmentCertificates: [],
    certificateByCode: [],
    learnerCertificates: [],
    issuedForCompletion: [{ n: "0" }],
    profileName: [{ full_name: "Amina Yusuf" }],
    ...overrides,
  };
  return (Object.keys(R) as (keyof typeof R)[]).map((key) => ({ match: R[key], rows: rows[key] }));
}

function recordings(executor: FakeExecutor, now = "2026-10-20T00:00:00Z") {
  return createRecordingService({ executor, flags: { coreSchemaReady: true }, clock: () => new Date(now), newId: sequentialIds("8b8b8b8b"), facts });
}

function certificates(executor: FakeExecutor, ready = true) {
  return createCertificateService({ executor, flags: { coreSchemaReady: ready }, clock: fixedClock, newId: sequentialIds("8c8c8c8c"), randomBytes: () => new Uint8Array(12).fill(7) });
}

describe("recording service", () => {
  test("learners see published recordings only, with links inside the window", async () => {
    const list = await recordings(fakeExecutor(world())).listClassGroupRecordings(student, IDS.classGroup);
    assert.equal(list.length, 1, "processing and restricted recordings are not listed for learners");
    assert.equal(list[0].mediaUrl, "https://video.example.test/lesson-3");
    const late = await recordings(fakeExecutor(world()), "2026-12-01T00:00:00Z").listClassGroupRecordings(student, IDS.classGroup);
    assert.equal(late[0].mediaUrl, null);
    assert.equal(late[0].unavailableReason, "expired");
  });

  test("teachers review every non-archived recording; outsiders and unpublished requests get nothing", async () => {
    const staff = await recordings(fakeExecutor(world({ policy: policies({}) }))).listClassGroupRecordings(teacher, IDS.classGroup);
    assert.equal(staff.length, 3);
    assert.equal(typeof staff[0].revision, "number", "staff need the revision to change a recording's state");
    const learnerView = await recordings(fakeExecutor(world())).listClassGroupRecordings(student, IDS.classGroup);
    assert.equal(learnerView[0].revision, undefined, "learners never receive administrative fields");
    assert.equal(learnerView[0].state, undefined);
    await rejectsForbidden(recordings(fakeExecutor(world())).listClassGroupRecordings(outsider, IDS.classGroup));
    await rejectsDomain(recordings(fakeExecutor(world({ recording: [recordingRow({ state: "in_review" })] }))).getRecording(student, RECORDING), "NOT_FOUND");
    await rejectsDomain(recordings(fakeExecutor(world({ policy: policies({}) }))).getRecording(student, RECORDING), "POLICY_UNCONFIGURED");
  });

  test("only administrators add or change recordings", async () => {
    await rejectsForbidden(recordings(fakeExecutor(world())).createRecording(teacher, IDS.session, { title: "x", mediaUrl: "https://v.example.test/x" }));
    await rejectsForbidden(recordings(fakeExecutor(world())).changeRecordingStatus(teacher, RECORDING, { to: "archived", reason: "x", expectedRevision: 3 }));
  });
});

describe("certificate service", () => {
  test("only administrators issue; eligibility and configuration are enforced", async () => {
    await rejectsForbidden(certificates(fakeExecutor(world())).issue(teacher, IDS.enrollment));
    await rejectsDomain(certificates(fakeExecutor(world({ policy: policies({}) }))).issue(admin, IDS.enrollment), "POLICY_UNCONFIGURED");
    await rejectsDomain(certificates(fakeExecutor(world({ completionByEnrollment: [] }))).issue(admin, IDS.enrollment), "CONFLICT");
    const executor = fakeExecutor(world());
    const certificate = await certificates(executor).issue(admin, IDS.enrollment);
    assert.equal(certificate.learnerNameSnapshot, "Amina Yusuf");
    assert.match(executor.transactions[0][0].text, /INSERT INTO academy_certificates[\s\S]*academy_audit_events/);
  });

  test("public verification: malformed codes never reach the database; known codes report their state", async () => {
    const malformed = fakeExecutor(world());
    assert.deepEqual(await certificates(malformed).verify("not a code"), { status: "not_found" });
    assert.equal(malformed.queries.length, 0);
    const known = fakeExecutor(world({
      certificateByCode: [{ id: "ce000000-0000-4000-8000-000000000001", code: "RQ-7777-7777-7777", enrollment_id: IDS.enrollment, completion_id: COMPLETION, learner_uid: "student-1", course_id: IDS.course, class_group_id: IDS.classGroup, learner_name_snapshot: "Amina Yusuf", course_title_snapshot: "Nahw 1", issued_at: "2026-12-21T00:00:00Z", issued_by: "admin-1", state: "issued", revoked_at: null, revoked_by: null, revoke_reason: null }],
    }));
    const result = await certificates(known).verify("rq-7777-7777-7777");
    assert.deepEqual(result, { status: "valid", learnerName: "Amina Yusuf", courseTitle: "Nahw 1", issuedAt: "2026-12-21T00:00:00.000Z" });
    await rejectsDomain(certificates(fakeExecutor(world()), false).verify("RQ-7777-7777-7777"), "FEATURE_UNAVAILABLE");
  });

  test("learners list only their own certificates", async () => {
    const executor = fakeExecutor(world());
    await certificates(executor).myCertificates(student);
    assert.equal(executor.queries[0].values[0], "student-1");
  });

  test("eligibility (administrators only) lists the enrollment's existing certificates so one can be revoked", async () => {
    await rejectsForbidden(certificates(fakeExecutor(world())).eligibility(teacher, IDS.enrollment));
    const issued = { id: "ce000000-0000-4000-8000-000000000002", code: "RQ-7777-7777-7777", enrollment_id: IDS.enrollment, completion_id: COMPLETION, learner_uid: "student-1", course_id: IDS.course, class_group_id: IDS.classGroup, learner_name_snapshot: "Amina Yusuf", course_title_snapshot: "Nahw 1", issued_at: "2026-12-21T00:00:00Z", issued_by: "admin-1", state: "issued", revoked_at: null, revoked_by: null, revoke_reason: null };
    const executor = fakeExecutor(world({ enrollmentCertificates: [issued] }));
    const view = await certificates(executor).eligibility(admin, IDS.enrollment);
    assert.equal(view.completionId, COMPLETION);
    assert.equal(view.completionRevoked, false);
    assert.deepEqual(view.certificates, [{ id: issued.id, code: "RQ-7777-7777-7777", state: "issued", issuedAt: "2026-12-21T00:00:00.000Z", revokedAt: null }]);
    const lookup = executor.queries.find((q) => R.enrollmentCertificates.test(q.text));
    assert.deepEqual(lookup?.values, [IDS.enrollment]);
  });

  test("a completion with an issued certificate cannot be revoked first", async () => {
    const progress = createProgressService({ executor: fakeExecutor(world({ issuedForCompletion: [{ n: "1" }] })), flags: { coreSchemaReady: true }, clock: fixedClock, facts });
    await rejectsDomain(progress.revokeCompletion(admin, COMPLETION, { reason: "Error" }), "CONFLICT");
  });
});
