/**
 * Readiness flags for academy capabilities.
 *
 * The academy schema ships as reviewed, unexecuted migrations. Until an
 * operator applies them to a database and sets ACADEMY_CORE_SCHEMA_READY=true,
 * every academy service reports a clean "not available yet" (503) instead of
 * failing against missing tables.
 *
 * A flag controls availability only. It never grants or widens access:
 * authorization runs regardless of any flag.
 */
import { DomainError } from "../domain/errors.ts";

export interface AcademyFeatureFlags {
  readonly coreSchemaReady: boolean;
}

export function readAcademyFlags(env: Readonly<Record<string, string | undefined>>): AcademyFeatureFlags {
  return Object.freeze({ coreSchemaReady: env.ACADEMY_CORE_SCHEMA_READY === "true" });
}

export function assertAcademyCoreAvailable(flags: AcademyFeatureFlags): void {
  if (!flags.coreSchemaReady) {
    throw new DomainError("FEATURE_UNAVAILABLE", "This part of the academy is not available yet.");
  }
}
