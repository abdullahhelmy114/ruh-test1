/**
 * Certificates: eligibility, issuance, revocation, the learner's own list,
 * and public verification by code.
 */
import type { AuthUser } from "../../auth/core.ts";
import {
  evaluateCertificateEligibility,
  normaliseCertificateCode,
  planIssueCertificate,
  planRevokeCertificate,
  verificationResult,
  type RandomBytes,
  type VerificationResult,
} from "../certificates/certificates.ts";
import { parseUuid } from "../domain/ids.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import { authorizeAdminAction } from "../permissions/permissions.ts";
import { mapCompletionRow, selectCompletionByEnrollmentQuery } from "../repo/assessment-repo.ts";
import { mapCourseRow, selectCourseQuery } from "../repo/catalog-repo.ts";
import { mapEnrollmentRow, selectEnrollmentQuery } from "../repo/delivery-repo.ts";
import {
  insertCertificateQuery,
  listEnrollmentCertificatesQuery,
  listLearnerCertificatesQuery,
  mapCertificateRow,
  revokeCertificateQuery,
  selectBestFinalScoreQuery,
  selectCertificateByCodeQuery,
  selectCertificateQuery,
  selectProfileNameQuery,
} from "../repo/recording-certificate-repo.ts";
import { numOrNull, strOrNull } from "../repo/rows.ts";
import { effectivePolicy } from "./policy-lookup.ts";
import { audited, contextFor, loadMany, loadOptional, loadRequired, runGuarded, type ServiceDeps } from "./support.ts";

export interface CertificateDeps extends ServiceDeps {
  /** Injectable for tests; defaults to a cryptographic source. */
  readonly randomBytes?: RandomBytes;
}

type Correlated = { readonly correlationId?: string | null };

export function createCertificateService(deps: CertificateDeps) {
  const { executor } = deps;

  async function eligibilityFor(enrollmentId: unknown) {
    const enrollment = await loadRequired(executor, selectEnrollmentQuery(parseUuid(enrollmentId, "enrollmentId")), mapEnrollmentRow, "Enrollment not found.");
    const course = await loadRequired(executor, selectCourseQuery(enrollment.courseId), mapCourseRow, "Course not found.");
    const [policy, completion, bestRows] = await Promise.all([
      effectivePolicy(executor, "certificate.eligibility", { programId: course.programId, courseId: course.id }),
      loadOptional(executor, selectCompletionByEnrollmentQuery(enrollment.id), mapCompletionRow),
      executor.query(selectBestFinalScoreQuery(enrollment.classGroupId, enrollment.learnerUid)),
    ]);
    const bestFinalScorePercent = bestRows.length === 0 ? null : numOrNull(bestRows[0].best);
    return { enrollment, course, completion, eligibility: evaluateCertificateEligibility({ policy, completion, bestFinalScorePercent }) };
  }

  return {
    async eligibility(user: AuthUser, enrollmentId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "certificate.issue");
      const { enrollment, completion, eligibility } = await eligibilityFor(enrollmentId);
      const certificates = await loadMany(executor, listEnrollmentCertificatesQuery(enrollment.id), mapCertificateRow);
      return {
        enrollmentId: enrollment.id,
        completionId: completion?.id ?? null,
        completionRevoked: completion ? completion.revokedAt !== null : null,
        eligibility,
        // Certificates already issued for this enrollment, so an administrator can revoke one.
        certificates: certificates.map((c) => ({ id: c.id, code: c.code, state: c.state, issuedAt: c.issuedAt, revokedAt: c.revokedAt })),
      };
    },

    async issue(user: AuthUser, enrollmentId: unknown, input: Correlated = {}) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "certificate.issue");
      const { enrollment, course, completion, eligibility } = await eligibilityFor(enrollmentId);
      const [existing, nameRows] = await Promise.all([
        loadMany(executor, listEnrollmentCertificatesQuery(enrollment.id), mapCertificateRow),
        executor.query(selectProfileNameQuery(enrollment.learnerUid)),
      ]);
      const plan = planIssueCertificate(
        {
          enrollment,
          completion,
          eligibility,
          learnerName: nameRows.length === 0 ? null : strOrNull(nameRows[0].full_name),
          courseTitle: course.title,
          existing,
          randomBytes: deps.randomBytes,
        },
        contextFor(user, deps, input.correlationId),
      );
      await runGuarded(executor, [audited(deps, insertCertificateQuery(plan.record), plan.audit)], {
        unique: "A certificate has already been issued for this enrollment.",
      });
      return plan.record;
    },

    async revoke(user: AuthUser, certificateId: unknown, input: Correlated & { readonly reason: unknown }) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "certificate.revoke");
      const certificate = await loadRequired(executor, selectCertificateQuery(parseUuid(certificateId, "certificateId")), mapCertificateRow, "Certificate not found.");
      const plan = planRevokeCertificate(certificate, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, revokeCertificateQuery(plan.record), plan.audit)]);
      return plan.record;
    },

    /** The caller's own certificates. */
    async myCertificates(user: AuthUser) {
      assertAcademyCoreAvailable(deps.flags);
      const records = await loadMany(executor, listLearnerCertificatesQuery(user.uid), mapCertificateRow);
      return records.map((record) => ({
        id: record.id,
        code: record.code,
        courseTitle: record.courseTitleSnapshot,
        learnerName: record.learnerNameSnapshot,
        issuedAt: record.issuedAt,
        state: record.state,
        revokedAt: record.revokedAt,
      }));
    },

    /** Public verification. Malformed codes are simply not found. */
    async verify(code: unknown): Promise<VerificationResult> {
      assertAcademyCoreAvailable(deps.flags);
      const normalised = normaliseCertificateCode(code);
      if (!normalised) return verificationResult(null);
      return verificationResult(await loadOptional(executor, selectCertificateByCodeQuery(normalised), mapCertificateRow));
    },
  };
}

export type CertificateService = ReturnType<typeof createCertificateService>;
