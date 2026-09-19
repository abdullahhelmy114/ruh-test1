/**
 * Where an account lands after signing in. Navigation only: every page and
 * API authorizes on the server (see SessionRole in ./core.ts).
 *
 *   administrator               → academy administration
 *   teacher, status "active"    → teacher academy workspace
 *   teacher, any other status   → the teacher application page (pending,
 *                                  changes requested, rejected, deactivated)
 *   everyone else               → learner academy workspace
 *
 * Every home is in the academy: the legacy /dashboard/student and
 * /dashboard/admin screens read tables outside the academy schema and now
 * redirect here too.
 *
 * Dependency-free so the browser and the server share one rule.
 */
export const ADMIN_HOME = "/academy/manage";
export const LEARNER_HOME = "/academy/learn";
export const TEACHER_WORKSPACE_HOME = "/academy/teach";
export const TEACHER_APPLICATION_HOME = "/academy/teacher-application";

export function accountHome(role: string | null | undefined, status: string | null | undefined): string {
  if (role === "admin") return ADMIN_HOME;
  if (role === "teacher") return status === "active" ? TEACHER_WORKSPACE_HOME : TEACHER_APPLICATION_HOME;
  return LEARNER_HOME;
}

/**
 * The home a server response names, if it is a path on this site; otherwise
 * the fallback. Never follows an absolute or protocol-relative URL.
 */
export function localHome(value: unknown, fallback: string): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : fallback;
}
