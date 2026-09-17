/**
 * Canonical state vocabularies with guarded transitions.
 *
 * Every lifecycle in the academy core is declared once here as data. Code must
 * move an entity between states through `assertTransition`, never by writing a
 * status string directly, so impossible transitions (publishing a draft that
 * was never reviewed, reopening a revoked certificate) cannot happen.
 *
 * Later batches add their own machines to this module rather than inventing
 * status strings in routes or components.
 */
import { DomainError } from "./errors.ts";

export interface StateMachine<S extends string> {
  readonly name: string;
  readonly states: readonly S[];
  readonly initial: S;
  readonly transitions: Readonly<Record<S, readonly S[]>>;
}

export function defineMachine<S extends string>(machine: StateMachine<S>): StateMachine<S> {
  const known = new Set<string>(machine.states);
  if (!known.has(machine.initial)) {
    throw new Error(`Machine ${machine.name}: initial state is not declared.`);
  }
  for (const state of machine.states) {
    const targets = machine.transitions[state];
    if (!Array.isArray(targets)) {
      throw new Error(`Machine ${machine.name}: state ${state} has no transition list.`);
    }
    for (const target of targets) {
      if (!known.has(target)) {
        throw new Error(`Machine ${machine.name}: ${state} -> ${target} targets an undeclared state.`);
      }
      if (target === state) {
        throw new Error(`Machine ${machine.name}: self-transition on ${state} is not allowed.`);
      }
    }
  }
  return Object.freeze({
    ...machine,
    states: Object.freeze([...machine.states]),
    transitions: Object.freeze({ ...machine.transitions }),
  });
}

export function isState<S extends string>(machine: StateMachine<S>, value: unknown): value is S {
  return typeof value === "string" && (machine.states as readonly string[]).includes(value);
}

export function parseState<S extends string>(machine: StateMachine<S>, value: unknown): S {
  if (!isState(machine, value)) {
    throw new DomainError("VALIDATION", `Unknown ${machine.name} state.`);
  }
  return value;
}

export function canTransition<S extends string>(machine: StateMachine<S>, from: S, to: S): boolean {
  return machine.transitions[from]?.includes(to) ?? false;
}

export function assertTransition<S extends string>(machine: StateMachine<S>, from: S, to: S): void {
  if (!canTransition(machine, from, to)) {
    throw new DomainError("INVALID_TRANSITION", `Cannot move ${machine.name} from ${from} to ${to}.`);
  }
}

export function isTerminal<S extends string>(machine: StateMachine<S>, state: S): boolean {
  return machine.transitions[state].length === 0;
}

// ---------------------------------------------------------------------------
// Governed content versions (curriculum versions, lesson script versions, ...)
// ---------------------------------------------------------------------------

export const CONTENT_VERSION_STATES = [
  "draft",
  "in_review",
  "changes_requested",
  "approved",
  "published",
  "superseded",
  "rejected",
  "archived",
] as const;

export type ContentVersionState = (typeof CONTENT_VERSION_STATES)[number];

export const CONTENT_VERSION_MACHINE = defineMachine<ContentVersionState>({
  name: "content version",
  states: CONTENT_VERSION_STATES,
  initial: "draft",
  transitions: {
    draft: ["in_review", "archived"],
    // Withdraw back to draft, return for revision, approve, or reject.
    in_review: ["draft", "changes_requested", "approved", "rejected"],
    changes_requested: ["in_review", "archived"],
    // Unapprove returns the version to review; publish makes it canonical.
    approved: ["in_review", "published"],
    published: ["superseded", "archived"],
    superseded: ["archived"],
    rejected: [],
    archived: [],
  },
});

/** Content may only be edited while the author holds it. */
export const MUTABLE_CONTENT_STATES: readonly ContentVersionState[] = ["draft", "changes_requested"];

// ---------------------------------------------------------------------------
// Catalog entities (programs and courses)
// ---------------------------------------------------------------------------

export const CATALOG_STATES = ["draft", "active", "retired"] as const;
export type CatalogState = (typeof CATALOG_STATES)[number];

export const CATALOG_MACHINE = defineMachine<CatalogState>({
  name: "catalog item",
  states: CATALOG_STATES,
  initial: "draft",
  transitions: {
    draft: ["active"],
    // Retiring stops new class groups; it never removes history.
    active: ["retired"],
    retired: ["active"],
  },
});

// ---------------------------------------------------------------------------
// Class groups (one delivery of a course)
// ---------------------------------------------------------------------------

export const CLASS_GROUP_STATES = ["planned", "active", "completed", "cancelled"] as const;
export type ClassGroupState = (typeof CLASS_GROUP_STATES)[number];

export const CLASS_GROUP_MACHINE = defineMachine<ClassGroupState>({
  name: "class group",
  states: CLASS_GROUP_STATES,
  initial: "planned",
  transitions: {
    planned: ["active", "cancelled"],
    active: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  },
});

// ---------------------------------------------------------------------------
// Sessions (one scheduled occurrence of a lesson for a class group)
// ---------------------------------------------------------------------------

export const SESSION_STATES = ["scheduled", "live", "completed", "cancelled"] as const;
export type SessionState = (typeof SESSION_STATES)[number];

export const SESSION_MACHINE = defineMachine<SessionState>({
  name: "session",
  states: SESSION_STATES,
  initial: "scheduled",
  transitions: {
    scheduled: ["live", "cancelled"],
    live: ["completed"],
    completed: [],
    cancelled: [],
  },
});

// ---------------------------------------------------------------------------
// Teacher preparation for a session
// ---------------------------------------------------------------------------

export const PREPARATION_STATES = ["not_started", "in_progress", "ready"] as const;
export type PreparationState = (typeof PREPARATION_STATES)[number];

export const PREPARATION_MACHINE = defineMachine<PreparationState>({
  name: "session preparation",
  states: PREPARATION_STATES,
  initial: "not_started",
  transitions: {
    not_started: ["in_progress", "ready"],
    in_progress: ["ready"],
    ready: ["in_progress"],
  },
});

// ---------------------------------------------------------------------------
// Enrollment (reflects entitlement; Whop remains the financial authority)
// ---------------------------------------------------------------------------

export const ENROLLMENT_STATES = ["pending", "active", "suspended", "completed", "withdrawn", "cancelled"] as const;
export type EnrollmentState = (typeof ENROLLMENT_STATES)[number];

export const ENROLLMENT_MACHINE = defineMachine<EnrollmentState>({
  name: "enrollment",
  states: ENROLLMENT_STATES,
  initial: "pending",
  transitions: {
    pending: ["active", "cancelled"],
    active: ["suspended", "completed", "withdrawn"],
    suspended: ["active", "withdrawn"],
    completed: [],
    withdrawn: [],
    cancelled: [],
  },
});

// ---------------------------------------------------------------------------
// Recordings
// ---------------------------------------------------------------------------

export const RECORDING_STATES = ["processing", "failed", "in_review", "published", "restricted", "archived"] as const;
export type RecordingState = (typeof RECORDING_STATES)[number];

export const RECORDING_MACHINE = defineMachine<RecordingState>({
  name: "recording",
  states: RECORDING_STATES,
  initial: "processing",
  transitions: {
    processing: ["in_review", "failed"],
    failed: ["processing"],
    in_review: ["published", "archived"],
    published: ["restricted", "archived"],
    restricted: ["published", "archived"],
    archived: [],
  },
});

// ---------------------------------------------------------------------------
// Teacher applications
// ---------------------------------------------------------------------------

export const TEACHER_APPLICATION_STATES = [
  "draft",
  "submitted",
  "in_review",
  "interview",
  "approved",
  "rejected",
  "withdrawn",
] as const;
export type TeacherApplicationState = (typeof TEACHER_APPLICATION_STATES)[number];

export const TEACHER_APPLICATION_MACHINE = defineMachine<TeacherApplicationState>({
  name: "teacher application",
  states: TEACHER_APPLICATION_STATES,
  initial: "draft",
  transitions: {
    draft: ["submitted", "withdrawn"],
    submitted: ["in_review", "withdrawn"],
    in_review: ["interview", "approved", "rejected", "withdrawn"],
    interview: ["approved", "rejected", "withdrawn"],
    approved: [],
    rejected: [],
    withdrawn: [],
  },
});

// ---------------------------------------------------------------------------
// Certificates
// ---------------------------------------------------------------------------

export const CERTIFICATE_STATES = ["issued", "revoked"] as const;
export type CertificateState = (typeof CERTIFICATE_STATES)[number];

export const CERTIFICATE_MACHINE = defineMachine<CertificateState>({
  name: "certificate",
  states: CERTIFICATE_STATES,
  initial: "issued",
  transitions: {
    issued: ["revoked"],
    revoked: [],
  },
});

// ---------------------------------------------------------------------------
// Approval gates
// ---------------------------------------------------------------------------

export const APPROVAL_GATE_STATES = ["open", "approved", "rejected", "changes_requested", "cancelled"] as const;
export type ApprovalGateState = (typeof APPROVAL_GATE_STATES)[number];

export const APPROVAL_GATE_MACHINE = defineMachine<ApprovalGateState>({
  name: "approval gate",
  states: APPROVAL_GATE_STATES,
  initial: "open",
  transitions: {
    open: ["approved", "rejected", "changes_requested", "cancelled"],
    approved: [],
    rejected: [],
    changes_requested: [],
    cancelled: [],
  },
});
