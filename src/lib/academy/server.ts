/**
 * Server wiring for the academy core.
 *
 * This is the only academy module that touches the real database client. The
 * domain, policy, permission, governance and repository modules stay pure and
 * are unit-tested with fakes; API routes and server components import the
 * ready-made services from here.
 */
import "server-only";
import { sql } from "@/lib/db/client";
import { getAdminAuth } from "@/lib/firebase/admin";
import { createWhopCheckout, resolveWhopConfig } from "@/lib/payments/whop";
import { privateDownloadLink } from "@/lib/security/cloudinary-sign";
import { readAcademyFlags } from "./infra/flags.ts";
import type { SqlExecutor, SqlRow } from "./infra/sql.ts";
import { createSqlReadingFacts } from "./repo/library-repo.ts";
import { createSqlRelationshipFacts } from "./repo/relationship-facts.ts";
import { createAdminService } from "./services/admin-service.ts";
import { createAssessmentAuthoringService } from "./services/assessment-authoring-service.ts";
import { createAssessmentService } from "./services/assessment-service.ts";
import { createAttendanceService } from "./services/attendance-service.ts";
import { createCatalogService } from "./services/catalog-service.ts";
import { createCertificateService } from "./services/certificate-service.ts";
import { createCommerceService } from "./services/commerce-service.ts";
import { createCommunicationService } from "./services/communication-service.ts";
import { createCurriculumService } from "./services/curriculum-service.ts";
import { createDeliveryService } from "./services/delivery-service.ts";
import { createGovernanceService } from "./services/governance-service.ts";
import { createLessonScriptService } from "./services/lesson-script-service.ts";
import { createLessonSheetService } from "./services/lesson-sheet-service.ts";
import { createLibraryService } from "./services/library-service.ts";
import { createParticipationService } from "./services/participation-service.ts";
import { academyTimeZone } from "./services/policy-lookup.ts";
import { createPolicyService } from "./services/policy-service.ts";
import { createPracticeService } from "./services/practice-service.ts";
import { createProductionService } from "./services/production-service.ts";
import { createProgressService } from "./services/progress-service.ts";
import { createPublicService } from "./services/public-service.ts";
import { createRecordingService } from "./services/recording-service.ts";
import { createTeacherService } from "./services/teacher-service.ts";

export const academyExecutor: SqlExecutor = {
  async query<T extends SqlRow = SqlRow>(query: { readonly text: string; readonly values: readonly unknown[] }) {
    return (await sql.query(query.text, [...query.values])) as T[];
  },
  async transaction(queries) {
    return (await sql.transaction(queries.map((query) => sql.query(query.text, [...query.values])))) as SqlRow[][];
  },
};

export const academyFlags = readAcademyFlags(process.env);

export const policyService = createPolicyService({ executor: academyExecutor, flags: academyFlags });

export const relationshipFacts = createSqlRelationshipFacts(academyExecutor);

export const governanceService = createGovernanceService({ executor: academyExecutor, flags: academyFlags });

export const adminService = createAdminService({ executor: academyExecutor, flags: academyFlags });

export const publicService = createPublicService({ executor: academyExecutor, flags: academyFlags });

export const productionService = createProductionService({ executor: academyExecutor, flags: academyFlags });

export const practiceService = createPracticeService({ executor: academyExecutor, flags: academyFlags, facts: relationshipFacts });

export const catalogService = createCatalogService({ executor: academyExecutor, flags: academyFlags });

export const curriculumService = createCurriculumService({ executor: academyExecutor, flags: academyFlags });

export const deliveryService = createDeliveryService({ executor: academyExecutor, flags: academyFlags });

export const lessonScriptService = createLessonScriptService({ executor: academyExecutor, flags: academyFlags });

export const lessonSheetService = createLessonSheetService({
  executor: academyExecutor,
  flags: academyFlags,
  facts: relationshipFacts,
});

export const participationService = createParticipationService({
  executor: academyExecutor,
  flags: academyFlags,
  facts: relationshipFacts,
});

export const attendanceService = createAttendanceService({
  executor: academyExecutor,
  flags: academyFlags,
  facts: relationshipFacts,
});

export const assessmentAuthoringService = createAssessmentAuthoringService({ executor: academyExecutor, flags: academyFlags });

export const assessmentService = createAssessmentService({
  executor: academyExecutor,
  flags: academyFlags,
  facts: relationshipFacts,
});

export const progressService = createProgressService({
  executor: academyExecutor,
  flags: academyFlags,
  facts: relationshipFacts,
});

export const recordingService = createRecordingService({
  executor: academyExecutor,
  flags: academyFlags,
  facts: relationshipFacts,
});

export const certificateService = createCertificateService({ executor: academyExecutor, flags: academyFlags });

export const communicationService = createCommunicationService({
  executor: academyExecutor,
  flags: academyFlags,
  facts: relationshipFacts,
});

// Whop: sandbox unless WHOP_API_BASE_URL names production exactly (src/lib/payments/whop.ts).
export const whopConfig = resolveWhopConfig({
  apiBase: process.env.WHOP_API_BASE_URL,
  apiKey: process.env.WHOP_API_KEY,
  webhookSecret: process.env.WHOP_WEBHOOK_SECRET,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
});

export const commerceService = createCommerceService({
  executor: academyExecutor,
  flags: academyFlags,
  gateway: {
    configured: whopConfig.apiKey !== null,
    open: (input) => createWhopCheckout(whopConfig, input),
  },
});

export const libraryService = createLibraryService({
  executor: academyExecutor,
  flags: academyFlags,
  facts: relationshipFacts,
  readingFacts: createSqlReadingFacts(academyExecutor),
});

export const teacherService = createTeacherService({
  executor: academyExecutor,
  flags: academyFlags,
  identity: {
    // The applicant's Firebase account, consulted before approval and shown on the review page.
    async signInAccount(uid) {
      try {
        const account = await getAdminAuth().getUser(uid);
        return { exists: true, disabled: account.disabled, emailVerified: account.emailVerified };
      } catch (error) {
        if ((error as { code?: unknown })?.code === "auth/user-not-found") return { exists: false, disabled: false, emailVerified: false };
        throw error;
      }
    },
  },
  documents: {
    // Short-lived signed links to private application documents; null when Cloudinary is not configured.
    temporaryLink(kind, storageId) {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (!cloudName || !apiKey || !apiSecret) return null;
      return privateDownloadLink({ cloudName, apiKey, apiSecret }, kind === "cv" ? "teacher_cv" : "teacher_intro_video", storageId);
    },
  },
});

/**
 * The academy's time zone for display, or null when it has not been set.
 *
 * One source for the whole product: the `institution.timezone` policy, which
 * also decides the Lesson Sheet release week. Server components resolve it
 * here and hand it to the workspace provider, so a session time reads the same
 * in the server HTML and in the browser.
 *
 * Reading it must never take a screen down, so a failure (the policy unset, or
 * the academy schema not ready) degrades to null and the screens leave times
 * blank. Scheduling itself is unaffected: release calculations still fail
 * closed in the services that own them.
 */
export async function academyDisplayTimeZone(): Promise<string | null> {
  try {
    return await academyTimeZone(academyExecutor);
  } catch {
    return null;
  }
}
