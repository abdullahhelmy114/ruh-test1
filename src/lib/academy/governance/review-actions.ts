/**
 * Maps the review commands an editor sends ("submit", "approve", ...) onto
 * governed version transitions. Shared by every versioned content type so
 * curriculum versions and lesson script versions review identically.
 */
import { DomainError } from "../domain/errors.ts";
import type { ReviewTransition, VersionRecord } from "./versioning.ts";

export const REVIEW_ACTIONS = ["submit", "withdraw", "request_changes", "approve", "reject", "unapprove", "archive"] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

export function parseReviewAction(value: unknown): ReviewAction {
  if (typeof value !== "string" || !(REVIEW_ACTIONS as readonly string[]).includes(value)) {
    throw new DomainError("VALIDATION", "Unknown review action.");
  }
  return value as ReviewAction;
}

/**
 * The transition for a review command. Reason text is validated by the
 * transition itself (required or optional per action).
 */
export function reviewTransitionFor(
  action: ReviewAction,
  version: Pick<VersionRecord, "state">,
  options: { readonly reason?: unknown; readonly selfApprovalAllowed: boolean },
): ReviewTransition {
  const reason = options.reason as string | undefined;
  switch (action) {
    case "submit":
      if (version.state === "approved") {
        throw new DomainError("INVALID_TRANSITION", "Use unapprove to send an approved version back to review.");
      }
      return { to: "in_review" };
    case "withdraw":
      return { to: "draft" };
    case "request_changes":
      return { to: "changes_requested", reason: reason as string };
    case "approve":
      return { to: "approved", reviewerMayBeAuthor: options.selfApprovalAllowed, reason };
    case "reject":
      return { to: "rejected", reason: reason as string };
    case "unapprove":
      if (version.state !== "approved") throw new DomainError("INVALID_TRANSITION", "Only an approved version can be unapproved.");
      return { to: "in_review", reason: reason ?? null };
    case "archive":
      return { to: "archived", reason: reason as string };
  }
}
