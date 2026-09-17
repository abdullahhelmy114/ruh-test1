/**
 * Lesson Sheets for learners, teachers and administrators.
 *
 * Every read goes through `openSheet`, which applies, in order:
 *   1. the capability flag;
 *   2. relationship permissions (learner: active in the class group of an
 *      accessible course; teacher: assigned to that class group);
 *   3. the LOCKED release rule (lessons/release.ts) using the academy time
 *      zone, for learners and teachers; administrators keep administrative
 *      visibility;
 *   4. the currently published script version, projected for the audience
 *      (learners never receive teacher notes or answers).
 *
 * If the academy time zone is not configured, learners and teachers get a
 * safe 503 rather than a guessed release time.
 */
import { AuthError, type AuthUser } from "../../auth/core.ts";
import { DomainError } from "../domain/errors.ts";
import { parseUuid, systemClock } from "../domain/ids.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import type { SqlRow } from "../infra/sql.ts";
import {
  planCreateAnnotation,
  planDeleteAnnotation,
  planUpdateAnnotation,
  withAnchorStatus,
  type AnnotationView,
} from "../lessons/annotations.ts";
import { projectContent, readStoredContent, type ContentAudience, type LessonContent } from "../lessons/content.ts";
import {
  emptyPreparation,
  planUpdatePreparation,
  toStatusView,
  type PreparationRecord,
  type PreparationStatusView,
} from "../lessons/preparation.ts";
import { sheetAvailability, type SheetAvailability } from "../lessons/release.ts";
import { authorize, authorizeAdminAction, type RelationshipFacts } from "../permissions/permissions.ts";
import { expectRows } from "../repo/audit-repo.ts";
import { listAssignmentsQuery, mapAssignmentRow, mapClassGroupRow, mapSessionRow, selectClassGroupQuery, selectSessionQuery } from "../repo/delivery-repo.ts";
import {
  insertAnnotationQuery,
  insertPreparationQuery,
  listOwnAnnotationsQuery,
  listPreparationStatusesQuery,
  mapAnnotationRow,
  mapLessonIdentity,
  mapPreparationRow,
  mapPreparationStatusRow,
  mapScriptRow,
  mapScriptVersionRow,
  selectClassGroupSheetSessionsQuery,
  selectLessonIdentityQuery,
  selectLessonSessionsQuery,
  selectLessonTitleQuery,
  selectOwnAnnotationQuery,
  selectOwnPreparationQuery,
  selectPublishedScriptVersionQuery,
  selectScriptByLessonQuery,
  updateAnnotationQuery,
  updatePreparationQuery,
  type LessonScriptVersionRecord,
} from "../repo/lesson-repo.ts";
import { iso, str, strOrNull } from "../repo/rows.ts";
import type { ClassGroupRecord } from "../structure/delivery.ts";
import { academyTimeZone } from "./policy-lookup.ts";
import { loadMany, loadOptional, runGuarded, type ServiceDeps } from "./support.ts";

export interface LessonSheetDeps extends ServiceDeps {
  readonly facts: RelationshipFacts;
}

interface OpenedSheet {
  readonly classGroup: ClassGroupRecord;
  readonly lessonId: string;
  readonly availability: SheetAvailability | null;
  readonly scriptId: string;
  readonly version: LessonScriptVersionRecord;
  readonly content: LessonContent;
}

function audienceOf(user: AuthUser): ContentAudience {
  return user.role === "student" ? "learner" : user.role;
}

const NOT_YET = "This Lesson Sheet is not available yet.";

export function createLessonSheetService(deps: LessonSheetDeps) {
  const { executor, facts } = deps;
  const now = () => (deps.clock ?? systemClock)();
  const timeZone = () => academyTimeZone(executor);

  /** Loads a class group; for non-administrators an unknown group is indistinguishable from a forbidden one. */
  async function loadClassGroupFor(user: AuthUser, classGroupId: unknown): Promise<ClassGroupRecord> {
    const id = parseUuid(classGroupId, "classGroupId");
    const group = await loadOptional(executor, selectClassGroupQuery(id), mapClassGroupRow);
    if (!group || group.deletedAt !== null) {
      if (user.role === "admin") throw new DomainError("NOT_FOUND", "Class group not found.");
      throw new AuthError("FORBIDDEN");
    }
    return group;
  }

  async function lessonSessions(classGroupId: string, lessonId: string) {
    const rows = await executor.query(selectLessonSessionsQuery(classGroupId, lessonId));
    return rows.map((row) => ({ id: str(row.id), startsAt: iso(row.starts_at), state: str(row.state) }));
  }

  async function releaseFor(user: AuthUser, classGroupId: string, lessonId: string): Promise<SheetAvailability | null> {
    const sessions = await lessonSessions(classGroupId, lessonId);
    if (user.role === "admin") {
      try {
        return sheetAvailability(sessions, await timeZone(), now());
      } catch (error) {
        if (error instanceof DomainError && error.code === "POLICY_UNCONFIGURED") return null;
        throw error;
      }
    }
    const availability = sheetAvailability(sessions, await timeZone(), now());
    if (availability.status !== "released") throw new DomainError("NOT_YET_AVAILABLE", NOT_YET);
    return availability;
  }

  async function openSheet(user: AuthUser, classGroupId: unknown, lessonId: unknown): Promise<OpenedSheet> {
    assertAcademyCoreAvailable(deps.flags);
    const group = await loadClassGroupFor(user, classGroupId);
    const lessonKey = parseUuid(lessonId, "lessonId");
    await authorize(user, { action: "lesson_sheet.read", courseId: group.courseId, classGroupId: group.id }, facts);

    const lesson = await loadOptional(executor, selectLessonIdentityQuery(lessonKey), mapLessonIdentity);
    if (!lesson || lesson.curriculumId !== group.curriculumId) throw new DomainError("NOT_FOUND", "Lesson Sheet not found.");

    const availability = await releaseFor(user, group.id, lesson.lessonId);

    const script = await loadOptional(executor, selectScriptByLessonQuery(lesson.lessonId), mapScriptRow);
    const publishedRows = script ? await executor.query(selectPublishedScriptVersionQuery(script.id)) : [];
    if (!script || publishedRows.length === 0) {
      throw new DomainError("NOT_FOUND", "This Lesson Sheet has not been published yet.");
    }
    const version = mapScriptVersionRow(publishedRows[0]);
    const content = projectContent(readStoredContent(publishedRows[0].content), audienceOf(user));
    return { classGroup: group, lessonId: lesson.lessonId, availability, scriptId: script.id, version, content };
  }

  async function ownAnnotations(user: AuthUser, scriptId: string, content: LessonContent): Promise<AnnotationView[]> {
    const records = await loadMany(executor, listOwnAnnotationsQuery(user.uid, scriptId), mapAnnotationRow);
    return withAnchorStatus(records, content);
  }

  async function openPreparation(user: AuthUser, sessionId: unknown) {
    assertAcademyCoreAvailable(deps.flags);
    const id = parseUuid(sessionId, "sessionId");
    const session = await loadOptional(executor, selectSessionQuery(id), mapSessionRow);
    if (!session) throw new AuthError("FORBIDDEN");
    await authorize(user, { action: "session.prepare", classGroupId: session.classGroupId }, facts);
    await releaseFor(user, session.classGroupId, session.lessonId);
    const current =
      (await loadOptional(executor, selectOwnPreparationQuery(session.id, user.uid), mapPreparationRow)) ??
      emptyPreparation(session.id, user.uid, now().toISOString());
    return { session, current };
  }

  return {
    async getSheet(user: AuthUser, classGroupId: unknown, lessonId: unknown) {
      const sheet = await openSheet(user, classGroupId, lessonId);
      const titleRows = await executor.query(selectLessonTitleQuery(sheet.lessonId, sheet.classGroup.curriculumVersionId));
      const title: SqlRow | undefined = titleRows[0];
      return {
        classGroupId: sheet.classGroup.id,
        courseId: sheet.classGroup.courseId,
        lesson: { id: sheet.lessonId, title: title ? str(title.title) : null, summary: title ? strOrNull(title.summary) : null },
        availability: sheet.availability,
        version: { id: sheet.version.id, versionNumber: sheet.version.versionNumber, publishedAt: sheet.version.publishedAt },
        content: sheet.content,
        annotations: await ownAnnotations(user, sheet.scriptId, sheet.content),
      };
    },

    /** Release status of every lesson scheduled for a class group (no content). */
    async listAvailability(user: AuthUser, classGroupId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const group = await loadClassGroupFor(user, classGroupId);
      await authorize(user, { action: "lesson_sheet.read", courseId: group.courseId, classGroupId: group.id }, facts);
      const zone = await timeZone();
      const rows = await executor.query(selectClassGroupSheetSessionsQuery(group.id));
      const byLesson = new Map<string, { title: string; sessions: { startsAt: string; state: string }[] }>();
      for (const row of rows) {
        const lessonId = str(row.lesson_id);
        const entry = byLesson.get(lessonId) ?? { title: str(row.lesson_title), sessions: [] };
        entry.sessions.push({ startsAt: iso(row.starts_at), state: str(row.state) });
        byLesson.set(lessonId, entry);
      }
      const at = now();
      return [...byLesson.entries()].map(([lessonId, entry]) => {
        const upcoming = entry.sessions.filter((s) => s.state !== "cancelled").map((s) => s.startsAt).sort();
        return {
          lessonId,
          lessonTitle: entry.title,
          firstSessionStartsAt: upcoming[0] ?? null,
          availability: sheetAvailability(entry.sessions, zone, at),
        };
      });
    },

    async createAnnotation(
      user: AuthUser,
      classGroupId: unknown,
      lessonId: unknown,
      input: { readonly blockId: unknown; readonly range?: unknown; readonly kind: unknown; readonly color?: unknown; readonly body?: unknown },
    ): Promise<AnnotationView> {
      const sheet = await openSheet(user, classGroupId, lessonId);
      await authorize(user, { action: "annotation.create", courseId: sheet.classGroup.courseId, classGroupId: sheet.classGroup.id }, facts);
      const existing = await loadMany(executor, listOwnAnnotationsQuery(user.uid, sheet.scriptId), mapAnnotationRow);
      const record = planCreateAnnotation(
        {
          ...input,
          lessonScriptId: sheet.scriptId,
          scriptVersionId: sheet.version.id,
          classGroupId: sheet.classGroup.id,
          visibleContent: sheet.content,
          existingCount: existing.length,
        },
        { ownerUid: user.uid, clock: deps.clock, newId: deps.newId },
      );
      await runGuarded(executor, [expectRows(insertAnnotationQuery(record), 1)]);
      return withAnchorStatus([record], sheet.content)[0];
    },

    async updateAnnotation(
      user: AuthUser,
      annotationId: unknown,
      input: { readonly kind?: unknown; readonly color?: unknown; readonly body?: unknown; readonly expectedRevision: unknown },
    ) {
      assertAcademyCoreAvailable(deps.flags);
      const id = parseUuid(annotationId, "annotationId");
      const record = await loadOptional(executor, selectOwnAnnotationQuery(user.uid, id), mapAnnotationRow);
      if (!record) throw new DomainError("NOT_FOUND", "Annotation not found.");
      await authorize(user, { action: "annotation.modify", ownerUid: record.ownerUid }, facts);
      const next = planUpdateAnnotation(record, input, { ownerUid: user.uid, clock: deps.clock });
      await runGuarded(executor, [expectRows(updateAnnotationQuery(next, record.revision), 1)]);
      return next;
    },

    async deleteAnnotation(user: AuthUser, annotationId: unknown, input: { readonly expectedRevision: unknown }) {
      assertAcademyCoreAvailable(deps.flags);
      const id = parseUuid(annotationId, "annotationId");
      const record = await loadOptional(executor, selectOwnAnnotationQuery(user.uid, id), mapAnnotationRow);
      if (!record) throw new DomainError("NOT_FOUND", "Annotation not found.");
      await authorize(user, { action: "annotation.modify", ownerUid: record.ownerUid }, facts);
      const next = planDeleteAnnotation(record, input, { ownerUid: user.uid, clock: deps.clock });
      await runGuarded(executor, [expectRows(updateAnnotationQuery(next, record.revision), 1)]);
      return { id: next.id, deleted: true };
    },

    async getPreparation(user: AuthUser, sessionId: unknown): Promise<PreparationRecord> {
      return (await openPreparation(user, sessionId)).current;
    },

    async updatePreparation(
      user: AuthUser,
      sessionId: unknown,
      input: { readonly status?: unknown; readonly privateNotes?: unknown; readonly expectedRevision: unknown },
    ): Promise<PreparationRecord> {
      const { current } = await openPreparation(user, sessionId);
      const next = planUpdatePreparation(current, input, { teacherUid: user.uid, clock: deps.clock });
      const statement = current.revision === 0 ? insertPreparationQuery(next) : updatePreparationQuery(next, current.revision);
      await runGuarded(executor, [expectRows(statement, 1)]);
      return next;
    },

    /** Administrators see each assigned teacher's preparation status, never their notes. */
    async listPreparationStatuses(user: AuthUser, sessionId: unknown): Promise<PreparationStatusView[]> {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "session.manage");
      const session = await loadOptional(executor, selectSessionQuery(parseUuid(sessionId, "sessionId")), mapSessionRow);
      if (!session) throw new DomainError("NOT_FOUND", "Session not found.");
      const [statuses, teachers] = await Promise.all([
        loadMany(executor, listPreparationStatusesQuery(session.id), mapPreparationStatusRow),
        loadMany(executor, listAssignmentsQuery(session.classGroupId, true), mapAssignmentRow),
      ]);
      const byTeacher = new Map(statuses.map((s) => [s.teacherUid, s]));
      const at = now().toISOString();
      return teachers.map((t) => byTeacher.get(t.teacherUid) ?? toStatusView(emptyPreparation(session.id, t.teacherUid, at)));
    },
  };
}

export type LessonSheetService = ReturnType<typeof createLessonSheetService>;
