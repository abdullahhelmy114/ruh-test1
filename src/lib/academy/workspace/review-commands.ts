/**
 * Review commands the administration screens offer for a governed version
 * (curriculum, Lesson Script, assessment or 2C content) in each state. The
 * server's state machine decides; this only avoids offering commands that
 * can never succeed. Checked against CONTENT_VERSION_MACHINE in tests.
 */
import type { ContentVersionState } from "../domain/states.ts";

export type ReviewCommand = "submit" | "withdraw" | "request_changes" | "approve" | "reject" | "unapprove" | "archive" | "publish";

/** The state each command moves a version to. */
export const COMMAND_TARGET: Readonly<Record<ReviewCommand, ContentVersionState>> = {
  submit: "in_review",
  withdraw: "draft",
  request_changes: "changes_requested",
  approve: "approved",
  reject: "rejected",
  unapprove: "in_review",
  archive: "archived",
  publish: "published",
};

export const COMMANDS_BY_STATE: Readonly<Record<ContentVersionState, readonly ReviewCommand[]>> = {
  draft: ["submit", "archive"],
  in_review: ["approve", "request_changes", "reject", "withdraw"],
  changes_requested: ["submit", "archive"],
  approved: ["publish", "unapprove"],
  published: ["archive"],
  superseded: ["archive"],
  rejected: [],
  archived: [],
};

/** Commands whose reason is required by the server (approval takes an optional one). */
export const REASON_REQUIRED: readonly ReviewCommand[] = ["request_changes", "reject", "unapprove", "archive"];

export function commandsFor(state: string): readonly ReviewCommand[] {
  return (COMMANDS_BY_STATE as Readonly<Record<string, readonly ReviewCommand[]>>)[state] ?? [];
}
