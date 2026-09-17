/**
 * Administrative authoring of canonical lesson scripts (the content behind
 * Lesson Sheets): drafts, content editing, review and publication.
 *
 * Only administrators author and publish canonical content. Teachers never
 * do (permissions: lesson_sheet.author / lesson_sheet.publish are admin-only).
 */
import type { AuthUser } from "../../auth/core.ts";
import type { AuditEventInput } from "../audit/audit.ts";
import { DomainError } from "../domain/errors.ts";
import { defaultIdGenerator, parseUuid, systemClock, toIso } from "../domain/ids.ts";
import { parseRequiredRevision } from "../domain/text.ts";
import { parseReviewAction, reviewTransitionFor } from "../governance/review-actions.ts";
import { assertContentMutable, createDraftVersion, publishVersion, touchDraftVersion, transitionVersion } from "../governance/versioning.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import type { SqlQuery } from "../infra/sql.ts";
import { hasTeachingContent, parseLessonContent, readStoredContent, type LessonContent } from "../lessons/content.ts";
import { authorizeAdminAction, type AdminOnlyAction } from "../permissions/permissions.ts";
import { selectPublicationGateDefinitionQuery } from "../repo/curriculum-repo.ts";
import {
  insertScriptQuery,
  insertScriptVersionQuery,
  listScriptVersionsQuery,
  mapLessonIdentity,
  mapScriptRow,
  mapScriptVersionRow,
  selectLessonIdentityQuery,
  selectScriptByLessonQuery,
  selectScriptVersionQuery,
  updateScriptVersionContentQuery,
  updateScriptVersionStateQuery,
  type LessonIdentity,
  type LessonScriptRecord,
  type LessonScriptVersionRecord,
} from "../repo/lesson-repo.ts";
import { audited, contextFor, loadMany, loadOptional, loadRequired, runGuarded, type ServiceDeps } from "./support.ts";

type Correlated = { readonly correlationId?: string | null };

const EMPTY_CONTENT: LessonContent = { blocks: [] };

export function createLessonScriptService(deps: ServiceDeps) {
  const { executor } = deps;

  function guard(user: AuthUser, action: AdminOnlyAction): void {
    assertAcademyCoreAvailable(deps.flags);
    authorizeAdminAction(user, action);
  }

  async function loadLesson(lessonId: unknown): Promise<LessonIdentity> {
    return loadRequired(executor, selectLessonIdentityQuery(parseUuid(lessonId, "lessonId")), mapLessonIdentity, "Lesson not found.");
  }

  async function loadVersionWithContent(versionId: unknown): Promise<{ version: LessonScriptVersionRecord; content: LessonContent }> {
    const rows = await executor.query(selectScriptVersionQuery(parseUuid(versionId, "versionId")));
    if (rows.length === 0) throw new DomainError("NOT_FOUND", "Lesson script version not found.");
    return { version: mapScriptVersionRow(rows[0]), content: readStoredContent(rows[0].content) };
  }

  function writeState(next: LessonScriptVersionRecord, previous: LessonScriptVersionRecord, audit: AuditEventInput): SqlQuery {
    return audited(deps, updateScriptVersionStateQuery(next, { revision: previous.revision, state: previous.state }), audit);
  }

  function bump(version: LessonScriptVersionRecord, previousRevision: number): LessonScriptVersionRecord {
    return Object.freeze({ ...version, revision: previousRevision + 1 });
  }

  return {
    async getScript(user: AuthUser, lessonId: unknown) {
      guard(user, "lesson_sheet.author");
      const lesson = await loadLesson(lessonId);
      const script = await loadOptional(executor, selectScriptByLessonQuery(lesson.lessonId), mapScriptRow);
      const versions = script ? await loadMany(executor, listScriptVersionsQuery(script.id), mapScriptVersionRow) : [];
      return { lesson, script, versions };
    },

    async getVersion(user: AuthUser, versionId: unknown) {
      guard(user, "lesson_sheet.author");
      return loadVersionWithContent(versionId);
    },

    /** Opens a draft (creating the lesson's script on first use), copying the published or chosen version. */
    async createDraft(user: AuthUser, lessonId: unknown, input: Correlated & { readonly basedOnVersionId?: unknown } = {}) {
      guard(user, "lesson_sheet.author");
      const lesson = await loadLesson(lessonId);
      const ctx = contextFor(user, deps, input.correlationId);
      const now = toIso((deps.clock ?? systemClock)());
      const statements: SqlQuery[] = [];

      let script = await loadOptional(executor, selectScriptByLessonQuery(lesson.lessonId), mapScriptRow);
      if (!script) {
        const created: LessonScriptRecord = Object.freeze({
          id: (deps.newId ?? defaultIdGenerator)(),
          lessonId: lesson.lessonId,
          curriculumId: lesson.curriculumId,
          createdBy: user.uid,
          createdAt: now,
        });
        statements.push(
          audited(deps, insertScriptQuery(created), {
            actor: ctx.actor,
            action: "lesson_script.create",
            object: { kind: "lesson_script", id: created.id },
            correlationId: ctx.correlationId,
            changedRelationships: [
              { change: "linked", relationship: "lesson_script", from: { kind: "lesson", id: lesson.lessonId }, to: { kind: "lesson_script", id: created.id } },
            ],
          }),
        );
        script = created;
      }

      const existing = await loadMany(executor, listScriptVersionsQuery(script.id), mapScriptVersionRow);
      let basedOn: LessonScriptVersionRecord | null = null;
      if (input.basedOnVersionId !== undefined && input.basedOnVersionId !== null && input.basedOnVersionId !== "") {
        const id = parseUuid(input.basedOnVersionId, "basedOnVersionId");
        basedOn = existing.find((v) => v.id === id) ?? null;
        if (!basedOn) throw new DomainError("VALIDATION", "A new version can only be based on a version of the same lesson script.");
      } else {
        basedOn = existing.find((v) => v.state === "published") ?? null;
      }
      const content = basedOn ? (await loadVersionWithContent(basedOn.id)).content : EMPTY_CONTENT;

      const change = createDraftVersion(
        { versionKind: "lesson_script_version", parentKind: "lesson_script", parentId: script.id, existingVersions: existing, basedOn, newId: deps.newId },
        ctx,
      );
      const version: LessonScriptVersionRecord = Object.freeze({ ...change.version, revision: 1 });
      statements.push(audited(deps, insertScriptVersionQuery(version, content), change.audit));
      await runGuarded(executor, statements, { unique: "A version is already being prepared for this lesson." });
      return { script, version };
    },

    async saveContent(user: AuthUser, versionId: unknown, input: Correlated & { readonly content: unknown; readonly expectedRevision: unknown }) {
      guard(user, "lesson_sheet.author");
      const { version } = await loadVersionWithContent(versionId);
      const expectedRevision = parseRequiredRevision(input.expectedRevision);
      assertContentMutable(version);
      if (version.revision !== expectedRevision) {
        throw new DomainError("CONFLICT", "This item was changed by someone else. Reload and try again.");
      }
      const content = parseLessonContent(input.content, deps.newId);
      const ctx = contextFor(user, deps, input.correlationId);
      const next: LessonScriptVersionRecord = Object.freeze({ ...touchDraftVersion(version, ctx), revision: version.revision + 1 });
      await runGuarded(executor, [
        audited(deps, updateScriptVersionContentQuery(next, content, expectedRevision), {
          actor: ctx.actor,
          action: "lesson_script_version.save_content",
          object: { kind: "lesson_script_version", id: version.id },
          newVersionId: version.id,
          correlationId: ctx.correlationId,
          metadata: { blocks: content.blocks.length, revision: next.revision },
        }),
      ]);
      return { version: next, content };
    },

    async review(
      user: AuthUser,
      versionId: unknown,
      input: Correlated & { readonly action: unknown; readonly reason?: unknown; readonly expectedRevision: unknown },
    ) {
      guard(user, "lesson_sheet.author");
      const action = parseReviewAction(input.action);
      if (action === "approve") authorizeAdminAction(user, "lesson_sheet.publish");
      const { version, content } = await loadVersionWithContent(versionId);
      if (version.revision !== parseRequiredRevision(input.expectedRevision)) {
        throw new DomainError("CONFLICT", "This item was changed by someone else. Reload and try again.");
      }
      let selfApprovalAllowed = false;
      if (action === "approve") {
        const rows = await executor.query(selectPublicationGateDefinitionQuery());
        selfApprovalAllowed = rows.length === 1 && rows[0].allow_self_approval === true;
      }
      const transition = reviewTransitionFor(action, version, { reason: input.reason, selfApprovalAllowed });
      if (action === "submit" && !hasTeachingContent(content)) {
        throw new DomainError("CONFLICT", "Add lesson content before submitting this version for review.");
      }
      const change = transitionVersion(version, transition, contextFor(user, deps, input.correlationId));
      const next = bump(change.version, version.revision);
      await runGuarded(executor, [writeState(next, version, change.audit)]);
      return next;
    },

    async publish(user: AuthUser, versionId: unknown, input: Correlated & { readonly expectedRevision: unknown }) {
      guard(user, "lesson_sheet.publish");
      const { version: target } = await loadVersionWithContent(versionId);
      if (target.revision !== parseRequiredRevision(input.expectedRevision)) {
        throw new DomainError("CONFLICT", "This item was changed by someone else. Reload and try again.");
      }
      const versions = await loadMany(executor, listScriptVersionsQuery(target.parentId), mapScriptVersionRow);
      const current = versions.find((v) => v.state === "published") ?? null;
      const result = publishVersion(target, current, contextFor(user, deps, input.correlationId));
      const published = bump(result.published, target.revision);
      const statements: SqlQuery[] = [];
      let superseded: LessonScriptVersionRecord | null = null;
      if (result.superseded && current) {
        superseded = bump(result.superseded, current.revision);
        statements.push(writeState(superseded, current, result.audits[1]));
      }
      statements.push(writeState(published, target, result.audits[0]));
      await runGuarded(executor, statements, { unique: "Another version was published at the same time. Reload and try again." });
      return { published, superseded };
    },
  };
}

export type LessonScriptService = ReturnType<typeof createLessonScriptService>;
