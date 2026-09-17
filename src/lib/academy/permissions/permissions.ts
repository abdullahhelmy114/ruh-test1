/**
 * Centralised academic permissions.
 *
 * Role checks alone are not enough in an academy: a teacher may act only on
 * the class groups they are assigned to, a learner may read only the courses
 * they are actively entitled to, and student-teacher messaging exists only
 * inside a live academic relationship. Every such decision goes through
 * `evaluateAccess`, with relationship facts injected (the same pattern as
 * `AuthDeps` in the auth core), so the rules are written once and unit-tested.
 *
 * Invariants encoded here are never configurable:
 *   - private annotations are readable and editable only by their owner,
 *     whatever the role (administrators included);
 *   - teachers cannot author or publish canonical content, change governed
 *     curriculum versions, grant entitlements or manage policy;
 *   - a class group must actually belong to the course being accessed.
 *
 * Time-based release (Lesson Sheets) and policy restrictions (for example
 * recording availability) are applied by services on top of these checks and
 * can only narrow access further.
 */
import { AuthError, type AuthUser, type Role } from "../../auth/core.ts";

export interface RelationshipFacts {
  /** The teacher is assigned to teach this class group. */
  isTeacherOfClassGroup(teacherUid: string, classGroupId: string): Promise<boolean>;
  /** The learner holds an active place in this class group. */
  isActiveLearnerOfClassGroup(learnerUid: string, classGroupId: string): Promise<boolean>;
  /** The class group is a delivery of this course. */
  classGroupBelongsToCourse(classGroupId: string, courseId: string): Promise<boolean>;
  /** The learner has active enrollment and entitlement for this course. */
  hasCourseAccess(learnerUid: string, courseId: string): Promise<boolean>;
  /** The teacher currently teaches a class group in which the learner is active. */
  hasActiveTeachingRelationship(teacherUid: string, learnerUid: string): Promise<boolean>;
}

export type AccessRequest =
  | { readonly action: "course.read_content"; readonly courseId: string; readonly classGroupId?: string | null }
  | { readonly action: "class_group.view"; readonly courseId: string; readonly classGroupId: string }
  | { readonly action: "lesson_sheet.read"; readonly courseId: string; readonly classGroupId?: string | null }
  | { readonly action: "annotation.create"; readonly courseId: string; readonly classGroupId?: string | null }
  | { readonly action: "annotation.read"; readonly ownerUid: string }
  | { readonly action: "annotation.modify"; readonly ownerUid: string }
  | { readonly action: "class_group.read_roster"; readonly classGroupId: string }
  | { readonly action: "attendance.record"; readonly classGroupId: string }
  | { readonly action: "submission.review"; readonly classGroupId: string }
  | { readonly action: "assessment.grade"; readonly classGroupId: string }
  | { readonly action: "feedback.write"; readonly classGroupId: string }
  | { readonly action: "session.conduct"; readonly classGroupId: string }
  | { readonly action: "session.prepare"; readonly classGroupId: string }
  | { readonly action: "recording.view"; readonly courseId: string; readonly classGroupId: string }
  | { readonly action: "message.send"; readonly recipient: { readonly uid: string; readonly role: Role } }
  | { readonly action: AdminOnlyAction };

export const ADMIN_ONLY_ACTIONS = [
  "lesson_sheet.author",
  "lesson_sheet.publish",
  "curriculum.modify",
  "recording.manage",
  "entitlement.grant",
  "policy.manage",
  "audit.read",
  "certificate.issue",
  "certificate.revoke",
  "approval_gate.configure",
  "content.soft_delete",
  "content.restore",
  "catalog.manage",
  "class_group.manage",
  "session.manage",
  "enrollment.manage",
  "assessment.author",
  "assessment.publish",
  "assessment.assign",
] as const;

export type AdminOnlyAction = (typeof ADMIN_ONLY_ACTIONS)[number];

export type AccessAction = AccessRequest["action"];

export type DenyReason = "role" | "relationship" | "access" | "privacy" | "self" | "invalid";

export type AccessDecision = { readonly allowed: true } | { readonly allowed: false; readonly reason: DenyReason };

const ALLOW: AccessDecision = Object.freeze({ allowed: true });

function deny(reason: DenyReason): AccessDecision {
  return Object.freeze({ allowed: false, reason });
}

export function isAdminOnlyAction(action: string): action is AdminOnlyAction {
  return (ADMIN_ONLY_ACTIONS as readonly string[]).includes(action);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

async function classGroupScopedForCourse(
  user: AuthUser,
  courseId: string,
  classGroupId: string | null | undefined,
  facts: RelationshipFacts,
): Promise<AccessDecision> {
  if (!nonEmpty(courseId)) return deny("invalid");
  if (user.role === "admin") return ALLOW;

  if (user.role === "teacher") {
    // A teacher's access to course content always flows through a class group
    // they teach, and that class group must belong to the requested course.
    if (!nonEmpty(classGroupId)) return deny("relationship");
    if (!(await facts.classGroupBelongsToCourse(classGroupId, courseId))) return deny("relationship");
    return (await facts.isTeacherOfClassGroup(user.uid, classGroupId)) ? ALLOW : deny("relationship");
  }

  // Learner
  if (!(await facts.hasCourseAccess(user.uid, courseId))) return deny("access");
  if (nonEmpty(classGroupId)) {
    if (!(await facts.classGroupBelongsToCourse(classGroupId, courseId))) return deny("relationship");
    if (!(await facts.isActiveLearnerOfClassGroup(user.uid, classGroupId))) return deny("relationship");
  }
  return ALLOW;
}

async function teacherOfClassGroup(user: AuthUser, classGroupId: string, facts: RelationshipFacts): Promise<AccessDecision> {
  if (!nonEmpty(classGroupId)) return deny("invalid");
  if (user.role === "admin") return ALLOW;
  if (user.role !== "teacher") return deny("role");
  return (await facts.isTeacherOfClassGroup(user.uid, classGroupId)) ? ALLOW : deny("relationship");
}

async function messaging(
  user: AuthUser,
  recipient: { readonly uid: string; readonly role: Role },
  facts: RelationshipFacts,
): Promise<AccessDecision> {
  if (!recipient || !nonEmpty(recipient.uid)) return deny("invalid");
  if (recipient.uid === user.uid) return deny("self");
  // Academy staff may contact anyone, and anyone may contact academy staff.
  if (user.role === "admin" || recipient.role === "admin") return ALLOW;
  if (user.role === "student" && recipient.role === "teacher") {
    return (await facts.hasActiveTeachingRelationship(recipient.uid, user.uid)) ? ALLOW : deny("relationship");
  }
  if (user.role === "teacher" && recipient.role === "student") {
    return (await facts.hasActiveTeachingRelationship(user.uid, recipient.uid)) ? ALLOW : deny("relationship");
  }
  // Learner-to-learner and teacher-to-teacher messaging is not part of the product.
  return deny("role");
}

export async function evaluateAccess(
  user: AuthUser,
  request: AccessRequest,
  facts: RelationshipFacts,
): Promise<AccessDecision> {
  if (!user || !nonEmpty(user.uid)) return deny("invalid");

  if (isAdminOnlyAction(request.action)) {
    return user.role === "admin" ? ALLOW : deny("role");
  }

  switch (request.action) {
    case "course.read_content":
    case "lesson_sheet.read":
    case "annotation.create":
      return classGroupScopedForCourse(user, request.courseId, request.classGroupId, facts);

    case "class_group.view":
      if (!nonEmpty(request.classGroupId)) return deny("invalid");
      return classGroupScopedForCourse(user, request.courseId, request.classGroupId, facts);

    case "annotation.read":
    case "annotation.modify":
      // Private notes belong to their author alone. No role can read or change
      // another person's private annotations.
      if (!nonEmpty(request.ownerUid)) return deny("invalid");
      return request.ownerUid === user.uid ? ALLOW : deny("privacy");

    case "class_group.read_roster":
    case "attendance.record":
    case "submission.review":
    case "assessment.grade":
    case "feedback.write":
    case "session.conduct":
      return teacherOfClassGroup(user, request.classGroupId, facts);

    case "session.prepare":
      // Preparation is the teacher's own work: administrators see status through
      // administrative views, never by acting as the teacher.
      if (user.role !== "teacher") return deny("role");
      if (!nonEmpty(request.classGroupId)) return deny("invalid");
      return (await facts.isTeacherOfClassGroup(user.uid, request.classGroupId)) ? ALLOW : deny("relationship");

    case "recording.view":
      if (!nonEmpty(request.classGroupId)) return deny("invalid");
      return classGroupScopedForCourse(user, request.courseId, request.classGroupId, facts);

    case "message.send":
      return messaging(user, request.recipient, facts);
  }
  return deny("invalid");
}

/**
 * Throws a generic 403 unless access is allowed. The reason is deliberately
 * not disclosed to the client.
 */
export async function authorize(user: AuthUser, request: AccessRequest, facts: RelationshipFacts): Promise<void> {
  const decision = await evaluateAccess(user, request, facts);
  if (!decision.allowed) throw new AuthError("FORBIDDEN");
}

/** Synchronous guard for administrative actions that need no relationship facts. */
export function authorizeAdminAction(user: AuthUser, action: AdminOnlyAction): void {
  if (!isAdminOnlyAction(action) || user?.role !== "admin") throw new AuthError("FORBIDDEN");
}
