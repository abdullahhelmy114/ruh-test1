/**
 * Certificates: eligibility, issuance, public verification and revocation.
 *
 * Eligibility applies the course's `certificate.eligibility` policy:
 *   - certificateOffered must be true;
 *   - requiresCompletion needs a recorded, unrevoked completion;
 *   - minimumFinalScorePercent (when set) needs a released final-assessment
 *     score at or above it.
 * Only administrators issue and revoke (certificate.issue / certificate.revoke).
 *
 * A certificate stores snapshots of the learner's name and the course title
 * at issuance, so later profile or catalog edits never change an issued
 * certificate. Public verification reveals only: valid, revoked or not found,
 * with the name, course, and dates on the certificate. It never reveals
 * account identifiers or contact details.
 */
import type { AuditEventInput } from "../audit/audit.ts";
import { DomainError, requireReason } from "../domain/errors.ts";
import { defaultIdGenerator, parseUid, systemClock, toIso, type IdGenerator } from "../domain/ids.ts";
import type { CertificateEligibilityPolicy } from "../policies/registry.ts";
import type { CompletionRecord } from "../learning/progress.ts";
import type { StructureContext } from "../structure/catalog.ts";
import type { EnrollmentRecord } from "../structure/delivery.ts";

/** Crockford base32 without I, L, O, U: unambiguous when read aloud or typed. */
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_PATTERN = /^RQ-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

export type RandomBytes = (length: number) => Uint8Array;

export const secureRandomBytes: RandomBytes = (length) => globalThis.crypto.getRandomValues(new Uint8Array(length));

/** RQ-XXXX-XXXX-XXXX: 60 random bits from a cryptographic source. */
export function generateCertificateCode(randomBytes: RandomBytes = secureRandomBytes): string {
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (byte) => CODE_ALPHABET[byte % 32]);
  return `RQ-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

/** Normalises a typed code (case, spaces, look-alike letters) or returns null when it cannot be a code. */
export function normaliseCertificateCode(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const compact = value.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (!/^RQ[0-9A-Z]{12}$/.test(compact)) return null;
  const code = `RQ-${compact.slice(2, 6)}-${compact.slice(6, 10)}-${compact.slice(10, 14)}`;
  return CODE_PATTERN.test(code) ? code : null;
}

export interface CertificateRecord {
  readonly id: string;
  readonly code: string;
  readonly enrollmentId: string;
  readonly completionId: string | null;
  readonly learnerUid: string;
  readonly courseId: string;
  readonly classGroupId: string;
  readonly learnerNameSnapshot: string;
  readonly courseTitleSnapshot: string;
  readonly issuedAt: string;
  readonly issuedBy: string;
  readonly state: "issued" | "revoked";
  readonly revokedAt: string | null;
  readonly revokedBy: string | null;
  readonly revokeReason: string | null;
}

export interface EligibilityCheck {
  readonly criterion: "certificate_offered" | "completion_recorded" | "minimum_final_score";
  readonly met: boolean;
  readonly detail: Record<string, unknown>;
}

export interface CertificateEligibility {
  readonly eligible: boolean;
  readonly checks: readonly EligibilityCheck[];
}

export function evaluateCertificateEligibility(input: {
  readonly policy: CertificateEligibilityPolicy;
  readonly completion: CompletionRecord | null;
  readonly bestFinalScorePercent: number | null;
}): CertificateEligibility {
  const checks: EligibilityCheck[] = [{ criterion: "certificate_offered", met: input.policy.certificateOffered, detail: {} }];
  if (input.policy.requiresCompletion) {
    checks.push({
      criterion: "completion_recorded",
      met: input.completion !== null && input.completion.revokedAt === null,
      detail: { completionId: input.completion?.id ?? null, revoked: input.completion ? input.completion.revokedAt !== null : null },
    });
  }
  if (input.policy.minimumFinalScorePercent !== null) {
    checks.push({
      criterion: "minimum_final_score",
      met: input.bestFinalScorePercent !== null && input.bestFinalScorePercent >= input.policy.minimumFinalScorePercent,
      detail: { bestFinalScorePercent: input.bestFinalScorePercent, minimum: input.policy.minimumFinalScorePercent },
    });
  }
  return { eligible: checks.every((check) => check.met), checks };
}

export function planIssueCertificate(
  input: {
    readonly enrollment: EnrollmentRecord;
    readonly completion: CompletionRecord | null;
    readonly eligibility: CertificateEligibility;
    readonly learnerName: string | null;
    readonly courseTitle: string;
    readonly existing: readonly CertificateRecord[];
    readonly randomBytes?: RandomBytes;
    readonly newId?: IdGenerator;
  },
  ctx: StructureContext,
): { readonly record: CertificateRecord; readonly audit: AuditEventInput } {
  if (!input.eligibility.eligible) {
    throw new DomainError("CONFLICT", "This learner is not eligible for a certificate under the course's rules.");
  }
  if (input.existing.some((c) => c.enrollmentId === input.enrollment.id && c.state === "issued")) {
    throw new DomainError("CONFLICT", "A certificate has already been issued for this enrollment.");
  }
  const learnerName = (input.learnerName ?? "").trim();
  if (learnerName.length === 0) {
    throw new DomainError("CONFLICT", "The learner's profile needs a full name before a certificate can be issued.");
  }
  const record: CertificateRecord = Object.freeze({
    id: (input.newId ?? ctx.newId ?? defaultIdGenerator)(),
    code: generateCertificateCode(input.randomBytes),
    enrollmentId: input.enrollment.id,
    completionId: input.completion?.id ?? null,
    learnerUid: input.enrollment.learnerUid,
    courseId: input.enrollment.courseId,
    classGroupId: input.enrollment.classGroupId,
    learnerNameSnapshot: learnerName.slice(0, 200),
    courseTitleSnapshot: input.courseTitle,
    issuedAt: toIso((ctx.clock ?? systemClock)()),
    issuedBy: parseUid(ctx.actor.uid, "actor"),
    state: "issued",
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "certificate.issue",
      object: { kind: "certificate", id: record.id },
      correlationId: ctx.correlationId ?? null,
      metadata: { enrollmentId: record.enrollmentId, completionId: record.completionId, courseId: record.courseId },
    },
  };
}

export function planRevokeCertificate(
  certificate: CertificateRecord,
  input: { readonly reason: unknown },
  ctx: StructureContext,
): { readonly record: CertificateRecord; readonly audit: AuditEventInput } {
  if (certificate.state !== "issued") throw new DomainError("CONFLICT", "This certificate is already revoked.");
  const reason = requireReason(input.reason);
  const record: CertificateRecord = Object.freeze({
    ...certificate,
    state: "revoked",
    revokedAt: toIso((ctx.clock ?? systemClock)()),
    revokedBy: parseUid(ctx.actor.uid, "actor"),
    revokeReason: reason,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "certificate.revoke",
      object: { kind: "certificate", id: certificate.id },
      reason,
      correlationId: ctx.correlationId ?? null,
      metadata: { enrollmentId: certificate.enrollmentId },
    },
  };
}

export type VerificationResult =
  | { readonly status: "valid"; readonly learnerName: string; readonly courseTitle: string; readonly issuedAt: string }
  | { readonly status: "revoked"; readonly learnerName: string; readonly courseTitle: string; readonly issuedAt: string; readonly revokedAt: string }
  | { readonly status: "not_found" };

/** The public answer for a certificate code. Never includes identifiers, reasons or contact details. */
export function verificationResult(certificate: CertificateRecord | null): VerificationResult {
  if (!certificate) return { status: "not_found" };
  const base = { learnerName: certificate.learnerNameSnapshot, courseTitle: certificate.courseTitleSnapshot, issuedAt: certificate.issuedAt };
  if (certificate.state === "revoked" && certificate.revokedAt) return { status: "revoked", ...base, revokedAt: certificate.revokedAt };
  return { status: "valid", ...base };
}
