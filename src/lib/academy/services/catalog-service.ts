/**
 * Administrative catalog service: programs and courses.
 *
 * Order of checks for every call: capability available -> administrator ->
 * identifiers valid -> load -> plan (validation, revision, transitions) ->
 * one guarded transaction that writes the change with its audit event.
 */
import type { AuthUser } from "../../auth/core.ts";
import { DomainError } from "../domain/errors.ts";
import { parseUuid, systemClock, toIso } from "../domain/ids.ts";
import { assertRevision, parseRequiredRevision } from "../domain/text.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import type { SqlQuery } from "../infra/sql.ts";
import { authorizeAdminAction } from "../permissions/permissions.ts";
import {
  countOf,
  countOpenClassGroupsQuery,
  countProgramCoursesQuery,
  expectCourseHasNoOpenClassGroupsQuery,
  expectProgramHasNoCoursesQuery,
  expectProgramNotDeletedQuery,
  insertCourseQuery,
  insertCurriculumQuery,
  insertProgramQuery,
  listCoursesQuery,
  listProgramsQuery,
  lockCourseQuery,
  lockProgramQuery,
  mapCourseRow,
  mapCurriculumRow,
  mapProgramRow,
  selectCourseQuery,
  selectCurriculumByCourseQuery,
  selectProgramQuery,
  updateCourseQuery,
  updateProgramQuery,
} from "../repo/catalog-repo.ts";
import { expectRows } from "../repo/audit-repo.ts";
import {
  planCourseStatus,
  planCreateCourse,
  planCreateProgram,
  planMoveCourse,
  planProgramStatus,
  planUpdateCourse,
  planUpdateProgram,
  type CatalogUpdateInput,
  type CourseRecord,
  type CurriculumRecord,
  type ProgramRecord,
  type StatusChangeInput,
} from "../structure/catalog.ts";
import { restoreSoftDeleted, softDelete } from "../governance/soft-delete.ts";
import { audited, contextFor, loadMany, loadOptional, loadRequired, runGuarded, touched, type ServiceDeps } from "./support.ts";

export interface ReasonedRevision {
  readonly reason: unknown;
  readonly expectedRevision: unknown;
  readonly correlationId?: string | null;
}

export function createCatalogService(deps: ServiceDeps) {
  const { executor } = deps;

  function guard(user: AuthUser): void {
    assertAcademyCoreAvailable(deps.flags);
    authorizeAdminAction(user, "catalog.manage");
  }

  async function loadProgram(programId: unknown): Promise<ProgramRecord> {
    return loadRequired(executor, selectProgramQuery(parseUuid(programId, "programId")), mapProgramRow, "Program not found.");
  }

  async function loadCourse(courseId: unknown): Promise<CourseRecord> {
    return loadRequired(executor, selectCourseQuery(parseUuid(courseId, "courseId")), mapCourseRow, "Course not found.");
  }

  async function loadOptionalProgram(programId: unknown): Promise<ProgramRecord | null> {
    if (programId === undefined || programId === null || programId === "") return null;
    return loadOptional(executor, selectProgramQuery(parseUuid(programId, "programId")), mapProgramRow);
  }

  function now(): string {
    return toIso((deps.clock ?? systemClock)());
  }

  /** Statements that keep a course's program from being deleted until this transaction ends. */
  function programStillThere(programId: string | null): SqlQuery[] {
    return programId === null ? [] : [lockProgramQuery(programId, "shared"), expectProgramNotDeletedQuery(programId)];
  }

  return {
    // -- Programs ------------------------------------------------------------

    async listPrograms(user: AuthUser, options: { readonly includeDeleted?: boolean } = {}): Promise<ProgramRecord[]> {
      guard(user);
      return loadMany(executor, listProgramsQuery({ includeDeleted: options.includeDeleted === true }), mapProgramRow);
    },

    async getProgram(user: AuthUser, programId: unknown): Promise<ProgramRecord> {
      guard(user);
      return loadProgram(programId);
    },

    async createProgram(
      user: AuthUser,
      input: { readonly slug: unknown; readonly title: unknown; readonly description?: unknown; readonly correlationId?: string | null },
    ): Promise<ProgramRecord> {
      guard(user);
      const plan = planCreateProgram(input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, insertProgramQuery(plan.record), plan.audit)], {
        unique: "A program with this slug already exists.",
      });
      return plan.record;
    },

    async updateProgram(user: AuthUser, programId: unknown, input: CatalogUpdateInput & { readonly correlationId?: string | null }) {
      guard(user);
      const current = await loadProgram(programId);
      const plan = planUpdateProgram(current, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, updateProgramQuery(plan.record, current.revision), plan.audit)]);
      return plan.record;
    },

    async changeProgramStatus(user: AuthUser, programId: unknown, input: StatusChangeInput & { readonly correlationId?: string | null }) {
      guard(user);
      const current = await loadProgram(programId);
      const plan = planProgramStatus(current, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, updateProgramQuery(plan.record, current.revision), plan.audit)]);
      return plan.record;
    },

    async deleteProgram(user: AuthUser, programId: unknown, input: ReasonedRevision): Promise<ProgramRecord> {
      guard(user);
      const current = await loadProgram(programId);
      assertRevision(current.revision, parseRequiredRevision(input.expectedRevision));
      if (countOf(await executor.query(countProgramCoursesQuery(current.id))) > 0) {
        throw new DomainError("CONFLICT", "Move or delete this program's courses first.");
      }
      const ctx = contextFor(user, deps, input.correlationId);
      const result = softDelete(current, { kind: "program", id: current.id }, { ...ctx, reason: input.reason as string });
      const next = touched(result.record, current.revision, user.uid, now());
      await runGuarded(executor, [
        lockProgramQuery(current.id, "exclusive"),
        expectProgramHasNoCoursesQuery(current.id),
        audited(deps, updateProgramQuery(next, current.revision), result.audit),
      ]);
      return next;
    },

    async restoreProgram(user: AuthUser, programId: unknown, input: ReasonedRevision): Promise<ProgramRecord> {
      guard(user);
      const current = await loadProgram(programId);
      assertRevision(current.revision, parseRequiredRevision(input.expectedRevision));
      const ctx = contextFor(user, deps, input.correlationId);
      const result = restoreSoftDeleted(current, { kind: "program", id: current.id }, { ...ctx, reason: input.reason as string });
      const next = touched(result.record, current.revision, user.uid, now());
      await runGuarded(executor, [audited(deps, updateProgramQuery(next, current.revision), result.audit)]);
      return next;
    },

    // -- Courses -------------------------------------------------------------

    async listCourses(user: AuthUser, options: { readonly programId?: unknown; readonly includeDeleted?: boolean } = {}) {
      guard(user);
      const programId =
        options.programId === undefined || options.programId === null || options.programId === ""
          ? null
          : parseUuid(options.programId, "programId");
      return loadMany(executor, listCoursesQuery({ programId, includeDeleted: options.includeDeleted === true }), mapCourseRow);
    },

    async getCourse(user: AuthUser, courseId: unknown): Promise<{ course: CourseRecord; curriculum: CurriculumRecord | null }> {
      guard(user);
      const course = await loadCourse(courseId);
      const curriculum = await loadOptional(executor, selectCurriculumByCourseQuery(course.id), mapCurriculumRow);
      return { course, curriculum };
    },

    async createCourse(
      user: AuthUser,
      input: {
        readonly programId?: unknown;
        readonly catalogCourseId?: unknown;
        readonly slug: unknown;
        readonly title: unknown;
        readonly description?: unknown;
        readonly correlationId?: string | null;
      },
    ): Promise<{ course: CourseRecord; curriculum: CurriculumRecord }> {
      guard(user);
      const program = await loadOptionalProgram(input.programId);
      const plan = planCreateCourse({ ...input, program }, contextFor(user, deps, input.correlationId));
      await runGuarded(
        executor,
        [
          ...programStillThere(plan.record.programId),
          audited(deps, insertCourseQuery(plan.record), plan.audit),
          expectRows(insertCurriculumQuery(plan.curriculum), 1),
        ],
        { unique: "A course with this slug or catalog link already exists." },
      );
      return { course: plan.record, curriculum: plan.curriculum };
    },

    async updateCourse(user: AuthUser, courseId: unknown, input: CatalogUpdateInput & { readonly correlationId?: string | null }) {
      guard(user);
      const current = await loadCourse(courseId);
      const plan = planUpdateCourse(current, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, updateCourseQuery(plan.record, current.revision), plan.audit)]);
      return plan.record;
    },

    async changeCourseStatus(user: AuthUser, courseId: unknown, input: StatusChangeInput & { readonly correlationId?: string | null }) {
      guard(user);
      const current = await loadCourse(courseId);
      const plan = planCourseStatus(current, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, updateCourseQuery(plan.record, current.revision), plan.audit)]);
      return plan.record;
    },

    async moveCourse(
      user: AuthUser,
      courseId: unknown,
      input: { readonly programId: unknown; readonly reason: unknown; readonly expectedRevision: unknown; readonly correlationId?: string | null },
    ) {
      guard(user);
      const current = await loadCourse(courseId);
      const program = await loadOptionalProgram(input.programId);
      const plan = planMoveCourse(current, { ...input, program }, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [...programStillThere(plan.record.programId), audited(deps, updateCourseQuery(plan.record, current.revision), plan.audit)]);
      return plan.record;
    },

    async deleteCourse(user: AuthUser, courseId: unknown, input: ReasonedRevision): Promise<CourseRecord> {
      guard(user);
      const current = await loadCourse(courseId);
      assertRevision(current.revision, parseRequiredRevision(input.expectedRevision));
      if (countOf(await executor.query(countOpenClassGroupsQuery(current.id))) > 0) {
        throw new DomainError("CONFLICT", "Finish or cancel this course's class groups first.");
      }
      const ctx = contextFor(user, deps, input.correlationId);
      const result = softDelete(current, { kind: "course", id: current.id }, { ...ctx, reason: input.reason as string });
      const next = touched(result.record, current.revision, user.uid, now());
      await runGuarded(executor, [
        lockCourseQuery(current.id, "exclusive"),
        expectCourseHasNoOpenClassGroupsQuery(current.id),
        audited(deps, updateCourseQuery(next, current.revision), result.audit),
      ]);
      return next;
    },

    async restoreCourse(user: AuthUser, courseId: unknown, input: ReasonedRevision): Promise<CourseRecord> {
      guard(user);
      const current = await loadCourse(courseId);
      assertRevision(current.revision, parseRequiredRevision(input.expectedRevision));
      const ctx = contextFor(user, deps, input.correlationId);
      const result = restoreSoftDeleted(current, { kind: "course", id: current.id }, { ...ctx, reason: input.reason as string });
      const next = touched(result.record, current.revision, user.uid, now());
      await runGuarded(executor, [audited(deps, updateCourseQuery(next, current.revision), result.audit)]);
      return next;
    },
  };
}

export type CatalogService = ReturnType<typeof createCatalogService>;
