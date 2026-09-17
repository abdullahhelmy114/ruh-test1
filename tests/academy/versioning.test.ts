/**
 * Academy core: governed content versioning.
 *
 * Required invariant covered here: published versions are immutable.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { AuthError } from "../../src/lib/auth/core.ts";
import { DomainError } from "../../src/lib/academy/domain/errors.ts";
import {
  assertContentMutable,
  createDraftVersion,
  nextVersionNumber,
  publishVersion,
  touchDraftVersion,
  transitionVersion,
  unapproveVersion,
  type VersionContext,
  type VersionRecord,
} from "../../src/lib/academy/governance/versioning.ts";

const CURRICULUM = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function ids() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}

function clockFrom(start: string) {
  let t = Date.parse(start);
  return () => new Date((t += 60_000));
}

const author: VersionContext = { actor: { uid: "author-uid", role: "admin" }, clock: clockFrom("2026-09-01T00:00:00Z") };
const reviewer: VersionContext = { actor: { uid: "reviewer-uid", role: "admin" }, clock: clockFrom("2026-09-02T00:00:00Z") };

function draft(existing: readonly VersionRecord[] = [], newId = ids(), basedOn: VersionRecord | null = null) {
  return createDraftVersion(
    { versionKind: "curriculum_version", parentKind: "curriculum", parentId: CURRICULUM, existingVersions: existing, basedOn, newId },
    author,
  ).version;
}

function toApproved(version: VersionRecord): VersionRecord {
  const submitted = transitionVersion(version, { to: "in_review" }, author).version;
  return transitionVersion(submitted, { to: "approved", reviewerMayBeAuthor: false }, reviewer).version;
}

function expectCode(fn: () => unknown, code: string) {
  assert.throws(fn, (error: unknown) => error instanceof DomainError && error.code === code);
}

describe("draft creation", () => {
  test("first draft is version 1 in draft state with an audit entry", () => {
    const newId = ids();
    const change = createDraftVersion(
      { versionKind: "curriculum_version", parentKind: "curriculum", parentId: CURRICULUM, existingVersions: [], newId },
      author,
    );
    assert.equal(change.version.versionNumber, 1);
    assert.equal(change.version.state, "draft");
    assert.equal(change.version.createdBy, "author-uid");
    assert.equal(change.audit.action, "version.create_draft");
    assert.equal(change.audit.newVersionId, change.version.id);
  });

  test("only one working version may exist per item", () => {
    const v1 = draft();
    expectCode(() => draft([v1]), "CONFLICT");
    const reviewing = transitionVersion(v1, { to: "in_review" }, author).version;
    expectCode(() => draft([reviewing]), "CONFLICT");
  });

  test("version numbers and identifiers are never reused", () => {
    const newId = ids();
    const v1 = toApproved(draft([], newId));
    const published = publishVersion(v1, null, reviewer).published;
    const v2 = draft([published], newId, published);
    assert.equal(v2.versionNumber, 2);
    assert.notEqual(v2.id, published.id);
    assert.equal(v2.basedOnVersionId, published.id);

    // A generator that repeats an existing id is refused.
    expectCode(
      () =>
        createDraftVersion(
          {
            versionKind: "curriculum_version",
            parentKind: "curriculum",
            parentId: CURRICULUM,
            existingVersions: [published],
            newId: () => published.id,
          },
          author,
        ),
      "CONFLICT",
    );
  });

  test("a draft cannot be based on another item's version", () => {
    const foreign = { ...draft(), parentId: "4f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e" };
    const archived = { ...foreign, state: "archived" as const };
    expectCode(
      () =>
        createDraftVersion(
          { versionKind: "curriculum_version", parentKind: "curriculum", parentId: CURRICULUM, existingVersions: [], basedOn: archived },
          author,
        ),
      "VALIDATION",
    );
  });

  test("nextVersionNumber rejects corrupt numbering", () => {
    assert.equal(nextVersionNumber([]), 1);
    assert.equal(nextVersionNumber([{ versionNumber: 1 }, { versionNumber: 4 }]), 5);
    expectCode(() => nextVersionNumber([{ versionNumber: 0 }]), "CONFLICT");
  });
});

describe("published versions are immutable", () => {
  test("drafts and returned versions are editable; everything else is not", () => {
    const v1 = draft();
    assert.doesNotThrow(() => assertContentMutable(v1));
    assert.ok(touchDraftVersion(v1, author).updatedAt > v1.updatedAt);

    const submitted = transitionVersion(v1, { to: "in_review" }, author).version;
    expectCode(() => assertContentMutable(submitted), "IMMUTABLE");

    const returned = transitionVersion(submitted, { to: "changes_requested", reason: "Fix section 2" }, reviewer).version;
    assert.doesNotThrow(() => assertContentMutable(returned));

    const approved = toApproved(draft());
    expectCode(() => assertContentMutable(approved), "IMMUTABLE");

    const published = publishVersion(approved, null, reviewer).published;
    expectCode(() => assertContentMutable(published), "IMMUTABLE");
    expectCode(() => touchDraftVersion(published, author), "IMMUTABLE");
  });

  test("a published version cannot be sent back to draft or review", () => {
    const published = publishVersion(toApproved(draft()), null, reviewer).published;
    expectCode(() => transitionVersion(published, { to: "draft" }, author), "INVALID_TRANSITION");
    expectCode(() => transitionVersion(published, { to: "in_review" }, author), "INVALID_TRANSITION");
  });
});

describe("review workflow", () => {
  test("return for revision requires a reason and is resubmittable", () => {
    const submitted = transitionVersion(draft(), { to: "in_review" }, author).version;
    expectCode(() => transitionVersion(submitted, { to: "changes_requested", reason: " " }, reviewer), "VALIDATION");
    const returned = transitionVersion(submitted, { to: "changes_requested", reason: "Add references" }, reviewer);
    assert.equal(returned.audit.action, "version.request_changes");
    assert.equal(returned.audit.reason, "Add references");
    const resubmitted = transitionVersion(returned.version, { to: "in_review" }, author);
    assert.equal(resubmitted.version.state, "in_review");
  });

  test("self-approval is refused unless explicitly allowed", () => {
    const submitted = transitionVersion(draft(), { to: "in_review" }, author).version;
    assert.throws(
      () => transitionVersion(submitted, { to: "approved", reviewerMayBeAuthor: false }, author),
      (error: unknown) => error instanceof AuthError && error.status === 403,
    );
    const approved = transitionVersion(submitted, { to: "approved", reviewerMayBeAuthor: true }, author);
    assert.equal(approved.version.state, "approved");
  });

  test("unapproval and rejection require reasons; rejection is final", () => {
    const approved = toApproved(draft());
    expectCode(() => unapproveVersion(approved, "", reviewer), "VALIDATION");
    const unapproved = unapproveVersion(approved, "Rights not cleared", reviewer);
    assert.equal(unapproved.version.state, "in_review");
    assert.equal(unapproved.audit.action, "version.unapprove");

    expectCode(() => transitionVersion(unapproved.version, { to: "rejected", reason: "" }, reviewer), "VALIDATION");
    const rejected = transitionVersion(unapproved.version, { to: "rejected", reason: "Out of scope" }, reviewer).version;
    expectCode(() => transitionVersion(rejected, { to: "in_review" }, author), "INVALID_TRANSITION");
  });

  test("archiving requires a reason", () => {
    expectCode(() => transitionVersion(draft(), { to: "archived", reason: "" }, author), "VALIDATION");
    const archived = transitionVersion(draft(), { to: "archived", reason: "Abandoned" }, author);
    assert.equal(archived.version.archivedAt !== null, true);
  });
});

describe("publication", () => {
  test("only an approved version can be published", () => {
    expectCode(() => publishVersion(draft(), null, reviewer), "INVALID_TRANSITION");
    const submitted = transitionVersion(draft(), { to: "in_review" }, author).version;
    expectCode(() => publishVersion(submitted, null, reviewer), "INVALID_TRANSITION");
  });

  test("publishing supersedes the current version and audits both", () => {
    const newId = ids();
    const v1 = publishVersion(toApproved(draft([], newId)), null, reviewer).published;
    const v2Approved = toApproved(draft([v1], newId, v1));
    const result = publishVersion(v2Approved, v1, reviewer);

    assert.equal(result.published.state, "published");
    assert.equal(result.published.publishedBy, "reviewer-uid");
    assert.equal(result.superseded?.state, "superseded");
    assert.equal(result.superseded?.id, v1.id, "the historical version stays addressable");
    assert.deepEqual(result.audits.map((a) => a.action), ["version.publish", "version.supersede"]);
    assert.equal(result.audits[0].previousVersionId, v1.id);
    assert.equal(result.audits[0].newVersionId, v2Approved.id);
  });

  test("an older version cannot be published over a newer one", () => {
    const newId = ids();
    const v1Approved = toApproved(draft([], newId));
    const v2 = publishVersion(
      toApproved({ ...draft([], newId), versionNumber: 2 }),
      null,
      reviewer,
    ).published;
    expectCode(() => publishVersion({ ...v1Approved, versionNumber: 1 }, v2, reviewer), "CONFLICT");
  });

  test("the current published version must belong to the same item", () => {
    const newId = ids();
    const other = publishVersion(toApproved(draft([], newId)), null, reviewer).published;
    const foreign = { ...other, parentId: "4f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e" };
    const target = toApproved({ ...draft([], newId), versionNumber: 5 });
    expectCode(() => publishVersion(target, foreign, reviewer), "CONFLICT");
  });
});
