/**
 * Session recordings: administration and viewing.
 *
 * Learners never learn that an unpublished recording exists, and receive the
 * media link only when the course policy and availability window allow it.
 */
import { AuthError, type AuthUser } from "../../auth/core.ts";
import { DomainError } from "../domain/errors.ts";
import { parseUuid, systemClock } from "../domain/ids.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import { authorize, authorizeAdminAction, evaluateAccess, type RelationshipFacts } from "../permissions/permissions.ts";
import { learnerWatchDecision, planCreateRecording, planRecordingStatus, recordingView, type RecordingRecord } from "../recordings/recordings.ts";
import { mapCourseRow, selectCourseQuery } from "../repo/catalog-repo.ts";
import { mapClassGroupRow, mapSessionRow, selectClassGroupQuery, selectSessionQuery } from "../repo/delivery-repo.ts";
import {
  insertRecordingQuery,
  listClassGroupRecordingsQuery,
  mapRecordingRow,
  selectRecordingQuery,
  updateRecordingQuery,
} from "../repo/recording-certificate-repo.ts";
import type { ClassGroupRecord } from "../structure/delivery.ts";
import { effectivePolicy } from "./policy-lookup.ts";
import { audited, contextFor, loadMany, loadOptional, loadRequired, runGuarded, type ServiceDeps } from "./support.ts";

export interface RecordingDeps extends ServiceDeps {
  readonly facts: RelationshipFacts;
}

type Correlated = { readonly correlationId?: string | null };

export function createRecordingService(deps: RecordingDeps) {
  const { executor, facts } = deps;
  const now = () => (deps.clock ?? systemClock)();

  async function loadGroupFor(user: AuthUser, classGroupId: string): Promise<ClassGroupRecord> {
    const group = await loadOptional(executor, selectClassGroupQuery(classGroupId), mapClassGroupRow);
    if (!group || group.deletedAt !== null) {
      if (user.role === "admin") throw new DomainError("NOT_FOUND", "Class group not found.");
      throw new AuthError("FORBIDDEN");
    }
    return group;
  }

  /** Administrators and the class group's assigned teachers review recordings. */
  async function isStaff(user: AuthUser, group: ClassGroupRecord): Promise<boolean> {
    if (user.role === "student") return false;
    return (await evaluateAccess(user, { action: "class_group.read_roster", classGroupId: group.id }, facts)).allowed;
  }

  async function learnerPolicy(group: ClassGroupRecord) {
    const course = await loadRequired(executor, selectCourseQuery(group.courseId), mapCourseRow, "Course not found.");
    return effectivePolicy(executor, "recordings.access", { programId: course.programId, courseId: course.id });
  }

  return {
    async createRecording(user: AuthUser, sessionId: unknown, input: Correlated & { readonly title: unknown; readonly mediaUrl: unknown; readonly durationSeconds?: unknown }) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "recording.manage");
      const session = await loadRequired(executor, selectSessionQuery(parseUuid(sessionId, "sessionId")), mapSessionRow, "Session not found.");
      const group = await loadRequired(executor, selectClassGroupQuery(session.classGroupId), mapClassGroupRow, "Class group not found.");
      const plan = planCreateRecording({ session, courseId: group.courseId, ...input }, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, insertRecordingQuery(plan.record), plan.audit)]);
      return plan.record;
    },

    async changeRecordingStatus(user: AuthUser, recordingId: unknown, input: Correlated & { readonly to: unknown; readonly reason?: unknown; readonly expectedRevision: unknown }) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "recording.manage");
      const current = await loadRequired(executor, selectRecordingQuery(parseUuid(recordingId, "recordingId")), mapRecordingRow, "Recording not found.");
      const plan = planRecordingStatus(current, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, updateRecordingQuery(plan.record, current), plan.audit)]);
      return plan.record;
    },

    async listClassGroupRecordings(user: AuthUser, classGroupId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const group = await loadGroupFor(user, parseUuid(classGroupId, "classGroupId"));
      if (await isStaff(user, group)) {
        const recordings = await loadMany(executor, listClassGroupRecordingsQuery(group.id), mapRecordingRow);
        return recordings.map((recording) => recordingView(recording, { staff: true }));
      }
      await authorize(user, { action: "recording.view", courseId: group.courseId, classGroupId: group.id }, facts);
      const [policy, recordings] = await Promise.all([learnerPolicy(group), loadMany(executor, listClassGroupRecordingsQuery(group.id), mapRecordingRow)]);
      const at = now();
      return recordings
        .map((recording) => ({ recording, decision: learnerWatchDecision(recording, policy, at) }))
        .filter(({ decision }) => decision.allowed || decision.reason !== "not_published")
        .map(({ recording, decision }) => recordingView(recording, decision));
    },

    async getRecording(user: AuthUser, recordingId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const recording: RecordingRecord | null = await loadOptional(executor, selectRecordingQuery(parseUuid(recordingId, "recordingId")), mapRecordingRow);
      if (!recording || recording.state === "archived") {
        if (user.role === "admin" && recording) return recordingView(recording, { staff: true });
        throw new DomainError("NOT_FOUND", "Recording not found.");
      }
      const group = await loadGroupFor(user, recording.classGroupId);
      if (await isStaff(user, group)) return recordingView(recording, { staff: true });
      await authorize(user, { action: "recording.view", courseId: group.courseId, classGroupId: group.id }, facts);
      const decision = learnerWatchDecision(recording, await learnerPolicy(group), now());
      if (!decision.allowed && decision.reason === "not_published") throw new DomainError("NOT_FOUND", "Recording not found.");
      return recordingView(recording, decision);
    },
  };
}

export type RecordingService = ReturnType<typeof createRecordingService>;
