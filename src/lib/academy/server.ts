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
import { readAcademyFlags } from "./infra/flags.ts";
import type { SqlExecutor, SqlRow } from "./infra/sql.ts";
import { createSqlReadingFacts } from "./repo/library-repo.ts";
import { createSqlRelationshipFacts } from "./repo/relationship-facts.ts";
import { createAssessmentAuthoringService } from "./services/assessment-authoring-service.ts";
import { createAssessmentService } from "./services/assessment-service.ts";
import { createAttendanceService } from "./services/attendance-service.ts";
import { createCatalogService } from "./services/catalog-service.ts";
import { createCommunicationService } from "./services/communication-service.ts";
import { createCurriculumService } from "./services/curriculum-service.ts";
import { createDeliveryService } from "./services/delivery-service.ts";
import { createLessonScriptService } from "./services/lesson-script-service.ts";
import { createLessonSheetService } from "./services/lesson-sheet-service.ts";
import { createLibraryService } from "./services/library-service.ts";
import { createParticipationService } from "./services/participation-service.ts";
import { createPolicyService } from "./services/policy-service.ts";
import { createProgressService } from "./services/progress-service.ts";

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

export const communicationService = createCommunicationService({
  executor: academyExecutor,
  flags: academyFlags,
  facts: relationshipFacts,
});

export const libraryService = createLibraryService({
  executor: academyExecutor,
  flags: academyFlags,
  facts: relationshipFacts,
  readingFacts: createSqlReadingFacts(academyExecutor),
});
