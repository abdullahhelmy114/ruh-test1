/**
 * Delivery of a course: class groups, teacher assignments, sessions and
 * enrollments.
 *
 *   Course       -> the academic offering
 *   Class Group  -> one delivery of that course, pinned to a PUBLISHED
 *                   curriculum version, with assigned teachers and learners
 *   Session      -> one scheduled occurrence of one lesson for a class group
 *   Enrollment   -> a learner's place in a class group
 *
 * Invariants enforced here (all pure; callers load the facts):
 *   - a class group only ever pins a published version of its own course's
 *     curriculum;
 *   - a session's lesson must exist in the class group's pinned version;
 *   - sessions carry absolute instants (UTC), never naive wall-clock times;
 *   - only learners are enrolled and only teachers are assigned to teach;
 *   - one open enrollment per learner per class group, within capacity.
 */
import type { Role } from "../../auth/core.ts";
import type { AuditEventInput } from "../audit/audit.ts";
import { DomainError, optionalReason, requireReason } from "../domain/errors.ts";
import { defaultIdGenerator, parseUid, parseUuid, systemClock, toIso } from "../domain/ids.ts";
import {
  CLASS_GROUP_MACHINE,
  ENROLLMENT_MACHINE,
  SESSION_MACHINE,
  assertTransition,
  parseState,
  type ClassGroupState,
  type EnrollmentState,
  type SessionState,
} from "../domain/states.ts";
import {
  assertRevision,
  parseInstant,
  parseOptionalDate,
  parseOptionalHttpsUrl,
  parseOptionalInt,
  parseRequiredRevision,
  parseTitle,
} from "../domain/text.ts";
import { assertVisible, type SoftDeletable } from "../governance/soft-delete.ts";
import type { CourseRecord, CurriculumRecord, Planned, StructureContext } from "./catalog.ts";
import type { CurriculumVersionRecord } from "./curriculum.ts";

/** Upper bound on one session's length; a data-entry guard, not an academic rule. */
export const MAX_SESSION_HOURS = 24;

function at(ctx: StructureContext): string {
  return toIso((ctx.clock ?? systemClock)());
}

function id(ctx: StructureContext): string {
  return (ctx.newId ?? defaultIdGenerator)();
}

function actorUid(ctx: StructureContext): string {
  return parseUid(ctx.actor.uid, "actor");
}

// ---------------------------------------------------------------------------
// Class groups
// ---------------------------------------------------------------------------

export interface ClassGroupRecord extends SoftDeletable {
  readonly id: string;
  readonly courseId: string;
  readonly curriculumId: string;
  readonly curriculumVersionId: string;
  readonly name: string;
  readonly status: ClassGroupState;
  readonly statusReason: string | null;
  readonly capacity: number | null;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly revision: number;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

function assertDateRange(startsOn: string | null, endsOn: string | null): void {
  if (startsOn && endsOn && endsOn < startsOn) {
    throw new DomainError("VALIDATION", "The end date cannot be before the start date.");
  }
}

function assertPinnable(course: CourseRecord, curriculum: CurriculumRecord, version: CurriculumVersionRecord): void {
  if (curriculum.courseId !== course.id || version.parentId !== curriculum.id) {
    throw new DomainError("VALIDATION", "The curriculum version does not belong to this course.");
  }
  if (version.state !== "published") {
    throw new DomainError("CONFLICT", "A class group can only follow a published curriculum version.");
  }
}

export interface CreateClassGroupInput {
  readonly course: CourseRecord;
  readonly curriculum: CurriculumRecord;
  readonly version: CurriculumVersionRecord;
  readonly name: unknown;
  readonly capacity?: unknown;
  readonly startsOn?: unknown;
  readonly endsOn?: unknown;
}

export function planCreateClassGroup(input: CreateClassGroupInput, ctx: StructureContext): Planned<ClassGroupRecord> {
  assertVisible(input.course);
  if (input.course.status !== "active") {
    throw new DomainError("CONFLICT", "Class groups can only be opened for an active course.");
  }
  assertPinnable(input.course, input.curriculum, input.version);
  const startsOn = parseOptionalDate(input.startsOn, "startsOn");
  const endsOn = parseOptionalDate(input.endsOn, "endsOn");
  assertDateRange(startsOn, endsOn);
  const uid = actorUid(ctx);
  const now = at(ctx);
  const record: ClassGroupRecord = Object.freeze({
    id: id(ctx),
    courseId: input.course.id,
    curriculumId: input.curriculum.id,
    curriculumVersionId: input.version.id,
    name: parseTitle(input.name, "name"),
    status: CLASS_GROUP_MACHINE.initial,
    statusReason: null,
    capacity: parseOptionalInt(input.capacity, "capacity", 1, 10000),
    startsOn,
    endsOn,
    revision: 1,
    createdBy: uid,
    createdAt: now,
    updatedBy: uid,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    deletionReason: null,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "class_group.create",
      object: { kind: "class_group", id: record.id },
      newVersionId: input.version.id,
      correlationId: ctx.correlationId ?? null,
      changedRelationships: [
        { change: "linked", relationship: "course_class_groups", from: { kind: "course", id: input.course.id }, to: { kind: "class_group", id: record.id } },
      ],
      metadata: { name: record.name, capacity: record.capacity, startsOn, endsOn },
    },
  };
}

export interface UpdateClassGroupInput {
  readonly name?: unknown;
  readonly capacity?: unknown;
  readonly startsOn?: unknown;
  readonly endsOn?: unknown;
  readonly expectedRevision: unknown;
  /** Open (pending, active, suspended) enrollments, to validate a lower capacity. */
  readonly openEnrollments: number;
}

export function planUpdateClassGroup(record: ClassGroupRecord, input: UpdateClassGroupInput, ctx: StructureContext): Planned<ClassGroupRecord> {
  assertVisible(record);
  assertRevision(record.revision, parseRequiredRevision(input.expectedRevision));
  if (record.status === "completed" || record.status === "cancelled") {
    throw new DomainError("CONFLICT", "A finished class group can no longer be edited.");
  }
  const changed: string[] = [];
  let { name, capacity, startsOn, endsOn } = record;
  if (input.name !== undefined) {
    const next = parseTitle(input.name, "name");
    if (next !== name) {
      name = next;
      changed.push("name");
    }
  }
  if (input.capacity !== undefined) {
    const next = parseOptionalInt(input.capacity, "capacity", 1, 10000);
    if (next !== null && next < input.openEnrollments) {
      throw new DomainError("CONFLICT", "Capacity cannot be lower than the number of enrolled learners.");
    }
    if (next !== capacity) {
      capacity = next;
      changed.push("capacity");
    }
  }
  if (input.startsOn !== undefined) {
    const next = parseOptionalDate(input.startsOn, "startsOn");
    if (next !== startsOn) {
      startsOn = next;
      changed.push("startsOn");
    }
  }
  if (input.endsOn !== undefined) {
    const next = parseOptionalDate(input.endsOn, "endsOn");
    if (next !== endsOn) {
      endsOn = next;
      changed.push("endsOn");
    }
  }
  if (changed.length === 0) throw new DomainError("VALIDATION", "Nothing to change.");
  assertDateRange(startsOn, endsOn);
  const updated: ClassGroupRecord = Object.freeze({
    ...record,
    name,
    capacity,
    startsOn,
    endsOn,
    revision: record.revision + 1,
    updatedBy: actorUid(ctx),
    updatedAt: at(ctx),
  });
  return {
    record: updated,
    audit: {
      actor: ctx.actor,
      action: "class_group.update",
      object: { kind: "class_group", id: record.id },
      correlationId: ctx.correlationId ?? null,
      metadata: { changed, revision: updated.revision },
    },
  };
}

export function planClassGroupStatus(
  record: ClassGroupRecord,
  input: { readonly to: unknown; readonly reason?: unknown; readonly expectedRevision: unknown },
  ctx: StructureContext,
): Planned<ClassGroupRecord> {
  assertVisible(record);
  assertRevision(record.revision, parseRequiredRevision(input.expectedRevision));
  const to = parseState(CLASS_GROUP_MACHINE, input.to);
  assertTransition(CLASS_GROUP_MACHINE, record.status, to);
  const reason = to === "cancelled" ? requireReason(input.reason) : optionalReason(input.reason);
  const updated: ClassGroupRecord = Object.freeze({
    ...record,
    status: to,
    statusReason: reason,
    revision: record.revision + 1,
    updatedBy: actorUid(ctx),
    updatedAt: at(ctx),
  });
  return {
    record: updated,
    audit: {
      actor: ctx.actor,
      action: "class_group.change_status",
      object: { kind: "class_group", id: record.id },
      reason,
      correlationId: ctx.correlationId ?? null,
      metadata: { from: record.status, to, revision: updated.revision },
    },
  };
}

export interface RepinInput {
  readonly course: CourseRecord;
  readonly curriculum: CurriculumRecord;
  readonly version: CurriculumVersionRecord;
  readonly reason: unknown;
  readonly expectedRevision: unknown;
  /** Lessons used by this class group's sessions that are still scheduled or live. */
  readonly lessonIdsInUse: ReadonlySet<string>;
  /** Lessons present in the target version's outline. */
  readonly lessonIdsInVersion: ReadonlySet<string>;
}

/**
 * Moves a class group to a newer published curriculum version. Sessions that
 * already happened keep the version they were taught from. Upcoming sessions
 * must still find their lesson in the new version.
 */
export function planRepinCurriculum(record: ClassGroupRecord, input: RepinInput, ctx: StructureContext): Planned<ClassGroupRecord> {
  assertVisible(record);
  assertRevision(record.revision, parseRequiredRevision(input.expectedRevision));
  if (record.status === "completed" || record.status === "cancelled") {
    throw new DomainError("CONFLICT", "A finished class group cannot change curriculum.");
  }
  if (input.course.id !== record.courseId) throw new DomainError("VALIDATION", "Course mismatch.");
  assertPinnable(input.course, input.curriculum, input.version);
  if (input.version.id === record.curriculumVersionId) {
    throw new DomainError("VALIDATION", "The class group already follows this version.");
  }
  const reason = requireReason(input.reason);
  const missing = [...input.lessonIdsInUse].filter((lessonId) => !input.lessonIdsInVersion.has(lessonId));
  if (missing.length > 0) {
    throw new DomainError(
      "CONFLICT",
      `${missing.length} upcoming session(s) teach lessons that are not in the new version. Reschedule or cancel them first.`,
    );
  }
  const updated: ClassGroupRecord = Object.freeze({
    ...record,
    curriculumVersionId: input.version.id,
    revision: record.revision + 1,
    updatedBy: actorUid(ctx),
    updatedAt: at(ctx),
  });
  return {
    record: updated,
    audit: {
      actor: ctx.actor,
      action: "class_group.repin_curriculum",
      object: { kind: "class_group", id: record.id },
      previousVersionId: record.curriculumVersionId,
      newVersionId: input.version.id,
      reason,
      correlationId: ctx.correlationId ?? null,
      metadata: { revision: updated.revision },
    },
  };
}

// ---------------------------------------------------------------------------
// Teacher assignments
// ---------------------------------------------------------------------------

export interface TeacherAssignmentRecord {
  readonly id: string;
  readonly classGroupId: string;
  readonly teacherUid: string;
  readonly assignedBy: string;
  readonly assignedAt: string;
  readonly unassignedBy: string | null;
  readonly unassignedAt: string | null;
  readonly unassignReason: string | null;
}

export interface ProfileFacts {
  readonly uid: string;
  readonly role: Role;
  readonly status: string | null;
}

function assertLiveGroup(group: ClassGroupRecord): void {
  assertVisible(group);
  if (group.status === "completed" || group.status === "cancelled") {
    throw new DomainError("CONFLICT", "This class group has finished.");
  }
}

export function planAssignTeacher(
  input: { readonly classGroup: ClassGroupRecord; readonly teacher: ProfileFacts | null; readonly activeAssignments: readonly TeacherAssignmentRecord[] },
  ctx: StructureContext,
): Planned<TeacherAssignmentRecord> {
  assertLiveGroup(input.classGroup);
  if (!input.teacher) throw new DomainError("NOT_FOUND", "Teacher not found.");
  if (input.teacher.role !== "teacher") {
    throw new DomainError("VALIDATION", "Only teacher accounts can be assigned to teach a class group.");
  }
  // Only an approved, active teacher account may teach (the same rule the auth layer applies).
  if (input.teacher.status !== "active") {
    throw new DomainError("CONFLICT", "This teacher account is not active.");
  }
  if (input.activeAssignments.some((a) => a.teacherUid === input.teacher?.uid && a.unassignedAt === null)) {
    throw new DomainError("CONFLICT", "This teacher is already assigned to the class group.");
  }
  const record: TeacherAssignmentRecord = Object.freeze({
    id: id(ctx),
    classGroupId: input.classGroup.id,
    teacherUid: input.teacher.uid,
    assignedBy: actorUid(ctx),
    assignedAt: at(ctx),
    unassignedBy: null,
    unassignedAt: null,
    unassignReason: null,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "class_group.assign_teacher",
      object: { kind: "class_group", id: input.classGroup.id },
      correlationId: ctx.correlationId ?? null,
      changedRelationships: [
        { change: "linked", relationship: "class_group_teachers", from: { kind: "class_group", id: input.classGroup.id }, to: { kind: "profile", id: input.teacher.uid } },
      ],
      metadata: { assignmentId: record.id },
    },
  };
}

export function planUnassignTeacher(
  input: { readonly classGroup: ClassGroupRecord; readonly assignment: TeacherAssignmentRecord | null; readonly reason: unknown },
  ctx: StructureContext,
): Planned<TeacherAssignmentRecord> {
  assertVisible(input.classGroup);
  const assignment = input.assignment;
  if (!assignment || assignment.classGroupId !== input.classGroup.id || assignment.unassignedAt !== null) {
    throw new DomainError("NOT_FOUND", "This teacher is not assigned to the class group.");
  }
  const reason = requireReason(input.reason);
  const record: TeacherAssignmentRecord = Object.freeze({
    ...assignment,
    unassignedBy: actorUid(ctx),
    unassignedAt: at(ctx),
    unassignReason: reason,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "class_group.unassign_teacher",
      object: { kind: "class_group", id: input.classGroup.id },
      reason,
      correlationId: ctx.correlationId ?? null,
      changedRelationships: [
        { change: "unlinked", relationship: "class_group_teachers", from: { kind: "class_group", id: input.classGroup.id }, to: { kind: "profile", id: assignment.teacherUid } },
      ],
      metadata: { assignmentId: assignment.id },
    },
  };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface SessionRecord {
  readonly id: string;
  readonly classGroupId: string;
  readonly curriculumVersionId: string;
  readonly lessonId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly state: SessionState;
  readonly stateReason: string | null;
  readonly meetingUrl: string | null;
  readonly revision: number;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

function parseWindow(startsAtInput: unknown, endsAtInput: unknown): { startsAt: string; endsAt: string } {
  const startsAt = parseInstant(startsAtInput, "startsAt");
  const endsAt = parseInstant(endsAtInput, "endsAt");
  const duration = Date.parse(endsAt) - Date.parse(startsAt);
  if (duration <= 0) throw new DomainError("VALIDATION", "A session must end after it starts.");
  if (duration > MAX_SESSION_HOURS * 3_600_000) {
    throw new DomainError("VALIDATION", `A session cannot be longer than ${MAX_SESSION_HOURS} hours.`);
  }
  return { startsAt, endsAt };
}

export interface ScheduleSessionInput {
  readonly classGroup: ClassGroupRecord;
  readonly lessonId: unknown;
  /** Lessons in the class group's pinned curriculum version. */
  readonly lessonIdsInPinnedVersion: ReadonlySet<string>;
  readonly startsAt: unknown;
  readonly endsAt: unknown;
  readonly meetingUrl?: unknown;
}

export function planScheduleSession(input: ScheduleSessionInput, ctx: StructureContext): Planned<SessionRecord> {
  assertLiveGroup(input.classGroup);
  const lessonId = parseUuid(input.lessonId, "lessonId");
  if (!input.lessonIdsInPinnedVersion.has(lessonId)) {
    throw new DomainError("VALIDATION", "This lesson is not part of the class group's curriculum version.");
  }
  const { startsAt, endsAt } = parseWindow(input.startsAt, input.endsAt);
  const uid = actorUid(ctx);
  const now = at(ctx);
  const record: SessionRecord = Object.freeze({
    id: id(ctx),
    classGroupId: input.classGroup.id,
    curriculumVersionId: input.classGroup.curriculumVersionId,
    lessonId,
    startsAt,
    endsAt,
    state: SESSION_MACHINE.initial,
    stateReason: null,
    meetingUrl: parseOptionalHttpsUrl(input.meetingUrl, "meetingUrl"),
    revision: 1,
    createdBy: uid,
    createdAt: now,
    updatedBy: uid,
    updatedAt: now,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "session.schedule",
      object: { kind: "session", id: record.id },
      correlationId: ctx.correlationId ?? null,
      changedRelationships: [
        { change: "linked", relationship: "class_group_sessions", from: { kind: "class_group", id: input.classGroup.id }, to: { kind: "session", id: record.id } },
      ],
      metadata: { lessonId, startsAt, endsAt, curriculumVersionId: record.curriculumVersionId },
    },
  };
}

export function planRescheduleSession(
  session: SessionRecord,
  input: { readonly startsAt: unknown; readonly endsAt: unknown; readonly meetingUrl?: unknown; readonly reason: unknown; readonly expectedRevision: unknown },
  ctx: StructureContext,
): Planned<SessionRecord> {
  assertRevision(session.revision, parseRequiredRevision(input.expectedRevision));
  if (session.state !== "scheduled") throw new DomainError("CONFLICT", "Only a scheduled session can be rescheduled.");
  const { startsAt, endsAt } = parseWindow(input.startsAt, input.endsAt);
  const reason = requireReason(input.reason);
  const meetingUrl = input.meetingUrl === undefined ? session.meetingUrl : parseOptionalHttpsUrl(input.meetingUrl, "meetingUrl");
  const updated: SessionRecord = Object.freeze({
    ...session,
    startsAt,
    endsAt,
    meetingUrl,
    revision: session.revision + 1,
    updatedBy: actorUid(ctx),
    updatedAt: at(ctx),
  });
  return {
    record: updated,
    audit: {
      actor: ctx.actor,
      action: "session.reschedule",
      object: { kind: "session", id: session.id },
      reason,
      correlationId: ctx.correlationId ?? null,
      metadata: {
        previousStartsAt: session.startsAt,
        previousEndsAt: session.endsAt,
        startsAt,
        endsAt,
        meetingLinkChanged: meetingUrl !== session.meetingUrl,
        revision: updated.revision,
      },
    },
  };
}

export function planSessionStatus(
  session: SessionRecord,
  input: { readonly to: unknown; readonly reason?: unknown; readonly expectedRevision: unknown },
  ctx: StructureContext,
): Planned<SessionRecord> {
  assertRevision(session.revision, parseRequiredRevision(input.expectedRevision));
  const to = parseState(SESSION_MACHINE, input.to);
  assertTransition(SESSION_MACHINE, session.state, to);
  const reason = to === "cancelled" ? requireReason(input.reason) : optionalReason(input.reason);
  const updated: SessionRecord = Object.freeze({
    ...session,
    state: to,
    stateReason: reason,
    revision: session.revision + 1,
    updatedBy: actorUid(ctx),
    updatedAt: at(ctx),
  });
  return {
    record: updated,
    audit: {
      actor: ctx.actor,
      action: "session.change_status",
      object: { kind: "session", id: session.id },
      reason,
      correlationId: ctx.correlationId ?? null,
      metadata: { from: session.state, to, revision: updated.revision },
    },
  };
}

// ---------------------------------------------------------------------------
// Enrollments
// ---------------------------------------------------------------------------

export const ENROLLMENT_SOURCES = ["admin", "entitlement"] as const;
export type EnrollmentSource = (typeof ENROLLMENT_SOURCES)[number];

export const OPEN_ENROLLMENT_STATES: readonly EnrollmentState[] = ["pending", "active", "suspended"];

export interface EnrollmentRecord {
  readonly id: string;
  readonly classGroupId: string;
  readonly courseId: string;
  readonly learnerUid: string;
  readonly state: EnrollmentState;
  readonly source: EnrollmentSource;
  readonly stateReason: string | null;
  readonly revision: number;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedBy: string;
  readonly updatedAt: string;
  readonly activatedAt: string | null;
  readonly endedAt: string | null;
}

export interface EnrollInput {
  readonly classGroup: ClassGroupRecord;
  readonly learner: ProfileFacts | null;
  /** Open enrollments already in this class group (all learners). */
  readonly openEnrollmentsInGroup: readonly Pick<EnrollmentRecord, "learnerUid" | "state">[];
  readonly activate: boolean;
  readonly source: EnrollmentSource;
}

export function planEnroll(input: EnrollInput, ctx: StructureContext): Planned<EnrollmentRecord> {
  assertLiveGroup(input.classGroup);
  if (!input.learner) throw new DomainError("NOT_FOUND", "Learner not found.");
  if (input.learner.role !== "student") {
    throw new DomainError("VALIDATION", "Only learner accounts can be enrolled in a class group.");
  }
  if (input.learner.status !== null && input.learner.status !== "active") {
    throw new DomainError("CONFLICT", "This learner account is not active.");
  }
  const open = input.openEnrollmentsInGroup.filter((e) => OPEN_ENROLLMENT_STATES.includes(e.state));
  if (open.some((e) => e.learnerUid === input.learner?.uid)) {
    throw new DomainError("CONFLICT", "This learner is already enrolled in the class group.");
  }
  if (input.classGroup.capacity !== null && open.length >= input.classGroup.capacity) {
    throw new DomainError("CONFLICT", "This class group is full.");
  }
  if (!ENROLLMENT_SOURCES.includes(input.source)) throw new DomainError("VALIDATION", "Unknown enrollment source.");
  const uid = actorUid(ctx);
  const now = at(ctx);
  const state: EnrollmentState = input.activate ? "active" : ENROLLMENT_MACHINE.initial;
  const record: EnrollmentRecord = Object.freeze({
    id: id(ctx),
    classGroupId: input.classGroup.id,
    courseId: input.classGroup.courseId,
    learnerUid: input.learner.uid,
    state,
    source: input.source,
    stateReason: null,
    revision: 1,
    createdBy: uid,
    createdAt: now,
    updatedBy: uid,
    updatedAt: now,
    activatedAt: input.activate ? now : null,
    endedAt: null,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "enrollment.create",
      object: { kind: "enrollment", id: record.id },
      correlationId: ctx.correlationId ?? null,
      changedRelationships: [
        { change: "linked", relationship: "class_group_learners", from: { kind: "class_group", id: input.classGroup.id }, to: { kind: "profile", id: input.learner.uid } },
      ],
      metadata: { state, source: input.source },
    },
  };
}

const ENDING_STATES: readonly EnrollmentState[] = ["completed", "withdrawn", "cancelled"];

export function planEnrollmentStatus(
  enrollment: EnrollmentRecord,
  input: { readonly to: unknown; readonly reason?: unknown; readonly expectedRevision: unknown },
  ctx: StructureContext,
): Planned<EnrollmentRecord> {
  assertRevision(enrollment.revision, parseRequiredRevision(input.expectedRevision));
  const to = parseState(ENROLLMENT_MACHINE, input.to);
  assertTransition(ENROLLMENT_MACHINE, enrollment.state, to);
  const needsReason = to === "suspended" || to === "withdrawn" || to === "cancelled";
  const reason = needsReason ? requireReason(input.reason) : optionalReason(input.reason);
  const now = at(ctx);
  const updated: EnrollmentRecord = Object.freeze({
    ...enrollment,
    state: to,
    stateReason: reason,
    revision: enrollment.revision + 1,
    updatedBy: actorUid(ctx),
    updatedAt: now,
    activatedAt: to === "active" && enrollment.activatedAt === null ? now : enrollment.activatedAt,
    endedAt: ENDING_STATES.includes(to) ? now : enrollment.endedAt,
  });
  return {
    record: updated,
    audit: {
      actor: ctx.actor,
      action: "enrollment.change_status",
      object: { kind: "enrollment", id: enrollment.id },
      reason,
      correlationId: ctx.correlationId ?? null,
      metadata: { from: enrollment.state, to, learnerUid: enrollment.learnerUid, classGroupId: enrollment.classGroupId, revision: updated.revision },
    },
  };
}
