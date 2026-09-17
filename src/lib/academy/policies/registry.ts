/**
 * Academic policy registry.
 *
 * Mutable academic decisions resolve ACADEMY DEFAULT -> PROGRAM OVERRIDE ->
 * COURSE OVERRIDE. This registry declares which decisions are configurable,
 * at which scopes, and the exact shape a value must have.
 *
 * It deliberately contains NO default values. Values are academy decisions,
 * entered by an administrator and audited; until one exists, resolution
 * reports `unconfigured` and callers must fail closed rather than guess.
 *
 * Not everything is a policy. Security invariants (authentication, role
 * separation, answer-key protection, private-note privacy, entitlement
 * enforcement) are code, never toggles. The Lesson Sheet release rule is a
 * locked product rule, also code, never a policy. `assertNotSecurityInvariant`
 * keeps those out of the registry.
 */
import { DomainError } from "../domain/errors.ts";
import { ASSESSMENT_MODES, PRODUCT_LOCALES, isAssessmentMode, type AssessmentMode } from "../domain/vocabulary.ts";

export const POLICY_SCOPES = ["academy", "program", "course"] as const;
export type PolicyScope = (typeof POLICY_SCOPES)[number];

export function isPolicyScope(value: unknown): value is PolicyScope {
  return typeof value === "string" && (POLICY_SCOPES as readonly string[]).includes(value);
}

export interface PolicyDefinition<V = unknown> {
  readonly key: string;
  readonly allowedScopes: readonly PolicyScope[];
  /** Validates and canonicalises a candidate value. Throws VALIDATION. */
  parse(value: unknown): V;
}

// ---------------------------------------------------------------------------
// Value validators
// ---------------------------------------------------------------------------

function invalid(key: string, detail: string): never {
  throw new DomainError("VALIDATION", `Invalid value for ${key}: ${detail}.`);
}

function record(key: string, value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(key, "expected an object");
  const obj = value as Record<string, unknown>;
  for (const field of Object.keys(obj)) {
    if (!fields.includes(field)) invalid(key, `unexpected field "${field}"`);
  }
  for (const field of fields) {
    if (!(field in obj)) invalid(key, `missing field "${field}"`);
  }
  return obj;
}

function bool(key: string, value: unknown, field: string): boolean {
  if (typeof value !== "boolean") invalid(key, `${field} must be true or false`);
  return value;
}

function intOrNull(key: string, value: unknown, field: string, min: number, max: number): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    invalid(key, `${field} must be a whole number from ${min} to ${max}, or null`);
  }
  return value;
}

function ratioOrNull(key: string, value: unknown, field: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    invalid(key, `${field} must be a number from 0 to 1, or null`);
  }
  return value;
}

function percentOrNull(key: string, value: unknown, field: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    invalid(key, `${field} must be a number from 0 to 100, or null`);
  }
  return value;
}

function oneOf<T extends string>(key: string, value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    invalid(key, `${field} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

function modes(key: string, value: unknown, field: string): AssessmentMode[] {
  if (!Array.isArray(value)) invalid(key, `${field} must be a list`);
  const seen = new Set<AssessmentMode>();
  for (const mode of value) {
    if (!isAssessmentMode(mode)) invalid(key, `${field} contains an unknown assessment mode`);
    if (seen.has(mode)) invalid(key, `${field} lists "${mode}" twice`);
    seen.add(mode);
  }
  return ASSESSMENT_MODES.filter((mode) => seen.has(mode));
}

// ---------------------------------------------------------------------------
// Value shapes
// ---------------------------------------------------------------------------

export interface AttendanceMark {
  readonly code: string;
  readonly countsAsAttended: boolean;
  readonly labels: Readonly<Record<(typeof PRODUCT_LOCALES)[number], string>>;
}

export interface AttendanceVocabulary {
  readonly marks: readonly AttendanceMark[];
}

export interface AttendanceRequirement {
  readonly minimumAttendedRatio: number | null;
}

export interface LateWorkPolicy {
  readonly acceptLateSubmissions: boolean;
  readonly latestHoursAfterDue: number | null;
  readonly markAsLate: boolean;
}

export interface RevisionPolicy {
  readonly revisionAllowed: boolean;
  readonly maxRevisions: number | null;
}

export interface AttemptLimitPolicy {
  readonly maxAttempts: number | null;
}

export const RESULT_RELEASE_MODES = ["immediate", "after_teacher_review", "manual_release"] as const;
export type ResultReleaseMode = (typeof RESULT_RELEASE_MODES)[number];

export interface ResultReleasePolicy {
  readonly mode: ResultReleaseMode;
}

export interface AssessmentRequirementsPolicy {
  readonly requiredModes: readonly AssessmentMode[];
}

export interface CompletionCriteriaPolicy {
  readonly requireAllLessonsCompleted: boolean;
  readonly minimumAttendedRatio: number | null;
  readonly requiredAssessmentModes: readonly AssessmentMode[];
  readonly minimumAssessmentScorePercent: number | null;
}

export interface CertificateEligibilityPolicy {
  readonly certificateOffered: boolean;
  readonly requiresCompletion: boolean;
  readonly minimumFinalScorePercent: number | null;
}

export const RECORDING_LEARNER_ACCESS = ["none", "enrolled_learners"] as const;
export type RecordingLearnerAccess = (typeof RECORDING_LEARNER_ACCESS)[number];

export interface RecordingAccessPolicy {
  readonly learnerAccess: RecordingLearnerAccess;
  readonly availableForDays: number | null;
  readonly downloadAllowed: boolean;
}

/**
 * Messaging policy can only RESTRICT. Student-teacher messaging always
 * additionally requires an active academic relationship, enforced in
 * permissions; no value here can widen that.
 */
export interface MessagingPolicy {
  readonly learnerMayMessageTeacher: boolean;
  readonly teacherMayMessageLearner: boolean;
}

const MARK_CODE = /^[a-z][a-z0-9_]{0,31}$/;

function parseTimezone(key: string, value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") invalid(key, "expected an IANA time zone name");
  try {
    const resolved = new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
    if (!resolved) invalid(key, "unknown time zone");
    return resolved;
  } catch {
    return invalid(key, "unknown time zone");
  }
}

function parseAttendanceVocabulary(key: string, value: unknown): AttendanceVocabulary {
  const obj = record(key, value, ["marks"]);
  if (!Array.isArray(obj.marks) || obj.marks.length < 1 || obj.marks.length > 12) {
    invalid(key, "marks must list between 1 and 12 entries");
  }
  const codes = new Set<string>();
  const marks = obj.marks.map((entry: unknown) => {
    const mark = record(key, entry, ["code", "countsAsAttended", "labels"]);
    if (typeof mark.code !== "string" || !MARK_CODE.test(mark.code)) invalid(key, "mark codes must be short lowercase identifiers");
    if (codes.has(mark.code)) invalid(key, `mark code "${mark.code}" is duplicated`);
    codes.add(mark.code);
    const labels = record(key, mark.labels, PRODUCT_LOCALES);
    const outLabels: Record<string, string> = {};
    for (const locale of PRODUCT_LOCALES) {
      const label = labels[locale];
      if (typeof label !== "string" || label.trim() === "" || label.length > 64) {
        invalid(key, `each mark needs a ${locale} label of 1 to 64 characters`);
      }
      outLabels[locale] = label.trim();
    }
    return Object.freeze({
      code: mark.code,
      countsAsAttended: bool(key, mark.countsAsAttended, "countsAsAttended"),
      labels: Object.freeze(outLabels) as AttendanceMark["labels"],
    });
  });
  return Object.freeze({ marks: Object.freeze(marks) });
}

// ---------------------------------------------------------------------------
// Security invariants (declared before the registry, which checks every key)
// ---------------------------------------------------------------------------

/**
 * Words that mark a security invariant or a locked product rule. None of these
 * may ever become an administrator-editable policy.
 */
const INVARIANT_FRAGMENTS = [
  "auth",
  "password",
  "token",
  "secret",
  "role",
  "permission",
  "answer",
  "private",
  "entitlement",
  "security",
  "lesson_sheet",
  "release_rule",
  "privacy",
] as const;

export function assertNotSecurityInvariant(key: string): void {
  const normalised = key.toLowerCase();
  for (const fragment of INVARIANT_FRAGMENTS) {
    if (normalised.includes(fragment)) {
      throw new Error(`"${key}" names a security invariant or locked rule and cannot be a policy.`);
    }
  }
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

const ALL_SCOPES: readonly PolicyScope[] = POLICY_SCOPES;

function define<V>(definition: PolicyDefinition<V>): PolicyDefinition<V> {
  assertNotSecurityInvariant(definition.key);
  return Object.freeze(definition);
}

export const POLICY_DEFINITIONS = {
  "institution.timezone": define<string>({
    key: "institution.timezone",
    allowedScopes: ["academy"],
    parse: (value) => parseTimezone("institution.timezone", value),
  }),
  "attendance.vocabulary": define<AttendanceVocabulary>({
    key: "attendance.vocabulary",
    allowedScopes: ALL_SCOPES,
    parse: (value) => parseAttendanceVocabulary("attendance.vocabulary", value),
  }),
  "attendance.requirement": define<AttendanceRequirement>({
    key: "attendance.requirement",
    allowedScopes: ALL_SCOPES,
    parse: (value) => {
      const key = "attendance.requirement";
      const obj = record(key, value, ["minimumAttendedRatio"]);
      return Object.freeze({ minimumAttendedRatio: ratioOrNull(key, obj.minimumAttendedRatio, "minimumAttendedRatio") });
    },
  }),
  "learning.late_work": define<LateWorkPolicy>({
    key: "learning.late_work",
    allowedScopes: ALL_SCOPES,
    parse: (value) => {
      const key = "learning.late_work";
      const obj = record(key, value, ["acceptLateSubmissions", "latestHoursAfterDue", "markAsLate"]);
      const accept = bool(key, obj.acceptLateSubmissions, "acceptLateSubmissions");
      const hours = intOrNull(key, obj.latestHoursAfterDue, "latestHoursAfterDue", 0, 8760);
      if (!accept && hours !== null) invalid(key, "latestHoursAfterDue must be null when late submissions are not accepted");
      return Object.freeze({ acceptLateSubmissions: accept, latestHoursAfterDue: hours, markAsLate: bool(key, obj.markAsLate, "markAsLate") });
    },
  }),
  "learning.revision": define<RevisionPolicy>({
    key: "learning.revision",
    allowedScopes: ALL_SCOPES,
    parse: (value) => {
      const key = "learning.revision";
      const obj = record(key, value, ["revisionAllowed", "maxRevisions"]);
      const allowed = bool(key, obj.revisionAllowed, "revisionAllowed");
      const max = intOrNull(key, obj.maxRevisions, "maxRevisions", 1, 20);
      if (!allowed && max !== null) invalid(key, "maxRevisions must be null when revision is not allowed");
      return Object.freeze({ revisionAllowed: allowed, maxRevisions: max });
    },
  }),
  "assessment.attempt_limit": define<AttemptLimitPolicy>({
    key: "assessment.attempt_limit",
    allowedScopes: ALL_SCOPES,
    parse: (value) => {
      const key = "assessment.attempt_limit";
      const obj = record(key, value, ["maxAttempts"]);
      return Object.freeze({ maxAttempts: intOrNull(key, obj.maxAttempts, "maxAttempts", 1, 100) });
    },
  }),
  "assessment.result_release": define<ResultReleasePolicy>({
    key: "assessment.result_release",
    allowedScopes: ALL_SCOPES,
    parse: (value) => {
      const key = "assessment.result_release";
      const obj = record(key, value, ["mode"]);
      return Object.freeze({ mode: oneOf(key, obj.mode, "mode", RESULT_RELEASE_MODES) });
    },
  }),
  "assessment.requirements": define<AssessmentRequirementsPolicy>({
    key: "assessment.requirements",
    allowedScopes: ALL_SCOPES,
    parse: (value) => {
      const key = "assessment.requirements";
      const obj = record(key, value, ["requiredModes"]);
      return Object.freeze({ requiredModes: Object.freeze(modes(key, obj.requiredModes, "requiredModes")) });
    },
  }),
  "completion.criteria": define<CompletionCriteriaPolicy>({
    key: "completion.criteria",
    allowedScopes: ALL_SCOPES,
    parse: (value) => {
      const key = "completion.criteria";
      const obj = record(key, value, [
        "requireAllLessonsCompleted",
        "minimumAttendedRatio",
        "requiredAssessmentModes",
        "minimumAssessmentScorePercent",
      ]);
      return Object.freeze({
        requireAllLessonsCompleted: bool(key, obj.requireAllLessonsCompleted, "requireAllLessonsCompleted"),
        minimumAttendedRatio: ratioOrNull(key, obj.minimumAttendedRatio, "minimumAttendedRatio"),
        requiredAssessmentModes: Object.freeze(modes(key, obj.requiredAssessmentModes, "requiredAssessmentModes")),
        minimumAssessmentScorePercent: percentOrNull(key, obj.minimumAssessmentScorePercent, "minimumAssessmentScorePercent"),
      });
    },
  }),
  "certificate.eligibility": define<CertificateEligibilityPolicy>({
    key: "certificate.eligibility",
    allowedScopes: ALL_SCOPES,
    parse: (value) => {
      const key = "certificate.eligibility";
      const obj = record(key, value, ["certificateOffered", "requiresCompletion", "minimumFinalScorePercent"]);
      return Object.freeze({
        certificateOffered: bool(key, obj.certificateOffered, "certificateOffered"),
        requiresCompletion: bool(key, obj.requiresCompletion, "requiresCompletion"),
        minimumFinalScorePercent: percentOrNull(key, obj.minimumFinalScorePercent, "minimumFinalScorePercent"),
      });
    },
  }),
  "recordings.access": define<RecordingAccessPolicy>({
    key: "recordings.access",
    allowedScopes: ALL_SCOPES,
    parse: (value) => {
      const key = "recordings.access";
      const obj = record(key, value, ["learnerAccess", "availableForDays", "downloadAllowed"]);
      const learnerAccess = oneOf(key, obj.learnerAccess, "learnerAccess", RECORDING_LEARNER_ACCESS);
      const days = intOrNull(key, obj.availableForDays, "availableForDays", 1, 3650);
      const download = bool(key, obj.downloadAllowed, "downloadAllowed");
      if (learnerAccess === "none" && (days !== null || download)) {
        invalid(key, "availability and download settings require learner access");
      }
      return Object.freeze({ learnerAccess, availableForDays: days, downloadAllowed: download });
    },
  }),
  "communications.messaging": define<MessagingPolicy>({
    key: "communications.messaging",
    allowedScopes: ALL_SCOPES,
    parse: (value) => {
      const key = "communications.messaging";
      const obj = record(key, value, ["learnerMayMessageTeacher", "teacherMayMessageLearner"]);
      return Object.freeze({
        learnerMayMessageTeacher: bool(key, obj.learnerMayMessageTeacher, "learnerMayMessageTeacher"),
        teacherMayMessageLearner: bool(key, obj.teacherMayMessageLearner, "teacherMayMessageLearner"),
      });
    },
  }),
} as const;

export type PolicyKey = keyof typeof POLICY_DEFINITIONS;

export type PolicyValue<K extends PolicyKey> = (typeof POLICY_DEFINITIONS)[K] extends PolicyDefinition<infer V> ? V : never;

export const POLICY_KEYS = Object.freeze(Object.keys(POLICY_DEFINITIONS) as PolicyKey[]);

export function isPolicyKey(value: unknown): value is PolicyKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(POLICY_DEFINITIONS, value);
}

export function getPolicyDefinition<K extends PolicyKey>(key: K): PolicyDefinition<PolicyValue<K>>;
export function getPolicyDefinition(key: unknown): PolicyDefinition;
export function getPolicyDefinition(key: unknown): PolicyDefinition {
  if (!isPolicyKey(key)) throw new DomainError("NOT_FOUND", "Unknown academy setting.");
  return POLICY_DEFINITIONS[key] as PolicyDefinition;
}
