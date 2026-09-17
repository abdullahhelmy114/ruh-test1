/**
 * Shared academic vocabularies that are not lifecycles.
 *
 * Kept in one place so policies, the assessment engine, reports and the UI all
 * speak the same words. Adding a value here is a product decision.
 */

/** The single assessment engine serves every mode below. */
export const ASSESSMENT_MODES = [
  "practice",
  "quiz",
  "homework",
  "writing",
  "oral",
  "placement",
  "midterm",
  "final",
] as const;

export type AssessmentMode = (typeof ASSESSMENT_MODES)[number];

export function isAssessmentMode(value: unknown): value is AssessmentMode {
  return typeof value === "string" && (ASSESSMENT_MODES as readonly string[]).includes(value);
}

/** Locales the product ships with. Arabic is right-to-left. */
export const PRODUCT_LOCALES = ["en", "ar", "tr"] as const;

export type ProductLocale = (typeof PRODUCT_LOCALES)[number];
