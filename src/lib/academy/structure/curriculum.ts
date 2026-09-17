/**
 * Curriculum versions and their outline (units and lessons).
 *
 * A Curriculum belongs to one Course and owns an ordered history of
 * Curriculum Versions (see governance/versioning.ts). A version's outline is
 * an ordered list of Units, each with an ordered list of Lessons.
 *
 * Units and Lessons have stable identities that survive across versions, so
 * "Lesson 3 in version 2" and "the same lesson in version 3" are one lesson:
 * lesson scripts, sessions and progress attach to that identity. Titles,
 * order and grouping are per version.
 *
 * Outlines can change only while the version is mutable (draft or changes
 * requested). A published outline is immutable.
 */
import type { AuditEventInput } from "../audit/audit.ts";
import { DomainError } from "../domain/errors.ts";
import { defaultIdGenerator, isUuid, parseUid, parseUuid } from "../domain/ids.ts";
import { parseOptionalInt, parseOptionalText, parseTitle } from "../domain/text.ts";
import { assertContentMutable, touchDraftVersion, type VersionRecord } from "../governance/versioning.ts";
import type { StructureContext } from "./catalog.ts";

export const MAX_UNITS = 100;
export const MAX_LESSONS_PER_UNIT = 100;
export const MAX_LESSONS_TOTAL = 1000;

/** A stored curriculum version: the governed version plus its edit revision. */
export interface CurriculumVersionRecord extends VersionRecord {
  readonly revision: number;
}

export interface OutlineLesson {
  readonly lessonId: string;
  readonly unitId: string;
  readonly position: number;
  readonly title: string;
  readonly summary: string | null;
  readonly plannedMinutes: number | null;
}

export interface OutlineUnit {
  readonly unitId: string;
  readonly position: number;
  readonly title: string;
  readonly summary: string | null;
  readonly lessons: readonly OutlineLesson[];
}

export interface Outline {
  readonly units: readonly OutlineUnit[];
}

interface DraftLesson {
  readonly lessonId: string | null;
  readonly title: string;
  readonly summary: string | null;
  readonly plannedMinutes: number | null;
}

interface DraftUnit {
  readonly unitId: string | null;
  readonly title: string;
  readonly summary: string | null;
  readonly lessons: readonly DraftLesson[];
}

/** Parses an outline submitted by an editor. Existing ids are kept; new items have none. */
export function parseOutlineInput(input: unknown): readonly DraftUnit[] {
  if (!input || typeof input !== "object" || !Array.isArray((input as { units?: unknown }).units)) {
    throw new DomainError("VALIDATION", "The outline must contain a list of units.");
  }
  const units = (input as { units: unknown[] }).units;
  if (units.length > MAX_UNITS) throw new DomainError("VALIDATION", `An outline can have at most ${MAX_UNITS} units.`);

  const seenUnits = new Set<string>();
  const seenLessons = new Set<string>();
  let lessonTotal = 0;

  return units.map((rawUnit, unitIndex) => {
    if (!rawUnit || typeof rawUnit !== "object") throw new DomainError("VALIDATION", `Unit ${unitIndex + 1} is invalid.`);
    const unit = rawUnit as Record<string, unknown>;
    const unitId = unit.unitId === undefined || unit.unitId === null ? null : parseUuid(unit.unitId, "unitId");
    if (unitId) {
      if (seenUnits.has(unitId)) throw new DomainError("VALIDATION", "A unit appears twice in the outline.");
      seenUnits.add(unitId);
    }
    if (!Array.isArray(unit.lessons)) throw new DomainError("VALIDATION", `Unit ${unitIndex + 1} must list its lessons.`);
    if (unit.lessons.length > MAX_LESSONS_PER_UNIT) {
      throw new DomainError("VALIDATION", `A unit can have at most ${MAX_LESSONS_PER_UNIT} lessons.`);
    }
    lessonTotal += unit.lessons.length;
    if (lessonTotal > MAX_LESSONS_TOTAL) {
      throw new DomainError("VALIDATION", `An outline can have at most ${MAX_LESSONS_TOTAL} lessons.`);
    }
    const lessons = unit.lessons.map((rawLesson: unknown, lessonIndex: number) => {
      if (!rawLesson || typeof rawLesson !== "object") {
        throw new DomainError("VALIDATION", `Lesson ${lessonIndex + 1} of unit ${unitIndex + 1} is invalid.`);
      }
      const lesson = rawLesson as Record<string, unknown>;
      const lessonId = lesson.lessonId === undefined || lesson.lessonId === null ? null : parseUuid(lesson.lessonId, "lessonId");
      if (lessonId) {
        if (seenLessons.has(lessonId)) throw new DomainError("VALIDATION", "A lesson appears twice in the outline.");
        seenLessons.add(lessonId);
      }
      return Object.freeze({
        lessonId,
        title: parseTitle(lesson.title, "Lesson title"),
        summary: parseOptionalText(lesson.summary, "Lesson summary"),
        plannedMinutes: parseOptionalInt(lesson.plannedMinutes, "plannedMinutes", 1, 1440),
      });
    });
    return Object.freeze({
      unitId,
      title: parseTitle(unit.title, "Unit title"),
      summary: parseOptionalText(unit.summary, "Unit summary"),
      lessons: Object.freeze(lessons),
    });
  });
}

export function countLessons(outline: Outline): number {
  return outline.units.reduce((total, unit) => total + unit.lessons.length, 0);
}

export function lessonIdsOf(outline: Outline): Set<string> {
  return new Set(outline.units.flatMap((unit) => unit.lessons.map((lesson) => lesson.lessonId)));
}

export interface SaveOutlineInput {
  readonly version: CurriculumVersionRecord;
  readonly curriculumId: string;
  readonly units: readonly DraftUnit[];
  readonly expectedRevision: number;
  /** Unit and lesson identities already recorded for this curriculum. */
  readonly knownUnitIds: ReadonlySet<string>;
  readonly knownLessonIds: ReadonlySet<string>;
  /** The outline currently stored for this version, for the change summary. */
  readonly currentOutline: Outline;
}

export interface SaveOutlinePlan {
  readonly version: CurriculumVersionRecord;
  readonly outline: Outline;
  readonly newUnitIds: readonly string[];
  readonly newLessonIds: readonly string[];
  readonly audit: AuditEventInput;
}

export function planSaveOutline(input: SaveOutlineInput, ctx: StructureContext): SaveOutlinePlan {
  assertContentMutable(input.version);
  if (input.version.parentId !== input.curriculumId) {
    throw new DomainError("CONFLICT", "This version belongs to a different curriculum.");
  }
  if (input.version.revision !== input.expectedRevision) {
    throw new DomainError("CONFLICT", "This item was changed by someone else. Reload and try again.");
  }
  parseUid(ctx.actor.uid, "actor");
  const generate = ctx.newId ?? defaultIdGenerator;
  const newUnitIds: string[] = [];
  const newLessonIds: string[] = [];

  const units: OutlineUnit[] = input.units.map((draftUnit, unitIndex) => {
    let unitId = draftUnit.unitId;
    if (unitId) {
      if (!input.knownUnitIds.has(unitId)) throw new DomainError("VALIDATION", "The outline references a unit from another curriculum.");
    } else {
      unitId = generate();
      if (!isUuid(unitId)) throw new Error("Identifier generator returned an invalid id.");
      newUnitIds.push(unitId);
    }
    const lessons: OutlineLesson[] = draftUnit.lessons.map((draftLesson, lessonIndex) => {
      let lessonId = draftLesson.lessonId;
      if (lessonId) {
        if (!input.knownLessonIds.has(lessonId)) {
          throw new DomainError("VALIDATION", "The outline references a lesson from another curriculum.");
        }
      } else {
        lessonId = generate();
        if (!isUuid(lessonId)) throw new Error("Identifier generator returned an invalid id.");
        newLessonIds.push(lessonId);
      }
      return Object.freeze({
        lessonId,
        unitId: unitId as string,
        position: lessonIndex + 1,
        title: draftLesson.title,
        summary: draftLesson.summary,
        plannedMinutes: draftLesson.plannedMinutes,
      });
    });
    return Object.freeze({
      unitId: unitId as string,
      position: unitIndex + 1,
      title: draftUnit.title,
      summary: draftUnit.summary,
      lessons: Object.freeze(lessons),
    });
  });

  const outline: Outline = Object.freeze({ units: Object.freeze(units) });
  const before = lessonIdsOf(input.currentOutline);
  const after = lessonIdsOf(outline);
  const removedLessons = [...before].filter((id) => !after.has(id)).length;
  const addedLessons = [...after].filter((id) => !before.has(id)).length;

  const touched = touchDraftVersion(input.version, ctx);
  const version: CurriculumVersionRecord = Object.freeze({ ...touched, revision: input.version.revision + 1 });

  return {
    version,
    outline,
    newUnitIds,
    newLessonIds,
    audit: {
      actor: ctx.actor,
      action: "curriculum_version.save_outline",
      object: { kind: "curriculum_version", id: input.version.id },
      newVersionId: input.version.id,
      correlationId: ctx.correlationId ?? null,
      metadata: {
        curriculumId: input.curriculumId,
        units: units.length,
        lessons: countLessons(outline),
        addedLessons,
        removedLessons,
        revision: version.revision,
      },
    },
  };
}

/** A version must have at least one lesson before it goes to review. */
export function assertOutlineReadyForReview(outline: Outline): void {
  if (countLessons(outline) === 0) {
    throw new DomainError("CONFLICT", "Add at least one lesson before submitting this curriculum version for review.");
  }
  for (const unit of outline.units) {
    if (unit.lessons.length === 0) {
      throw new DomainError("CONFLICT", `Unit "${unit.title}" has no lessons. Add lessons or remove the unit before review.`);
    }
  }
}

/** Freshly created versions start at revision 1. */
export function withInitialRevision(version: VersionRecord): CurriculumVersionRecord {
  return Object.freeze({ ...version, revision: 1 });
}

/** Revision bump applied to every persisted version transition. */
export function bumpRevision(version: CurriculumVersionRecord, previousRevision: number): CurriculumVersionRecord {
  return Object.freeze({ ...version, revision: previousRevision + 1 });
}
