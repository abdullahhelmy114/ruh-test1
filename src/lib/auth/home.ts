/**
 * Where an account lands after signing in. Navigation only: every page and
 * API authorizes on the server (see SessionRole in ./core.ts).
 *
 *   administrator               → administration dashboard
 *   teacher, status "active"    → teacher academy workspace
 *   teacher, any other status   → the teacher application page (pending,
 *                                  changes requested, rejected, deactivated)
 *   everyone else               → student dashboard
 *
 * Dependency-free so the browser and the server share one rule.
 */
export const TEACHER_WORKSPACE_HOME = "/academy/teach";
export const TEACHER_APPLICATION_HOME = "/academy/teacher-application";

export function accountHome(role: string | null | undefined, status: string | null | undefined): string {
  if (role === "admin") return "/dashboard/admin";
  if (role === "teacher") return status === "active" ? TEACHER_WORKSPACE_HOME : TEACHER_APPLICATION_HOME;
  return "/dashboard/student";
}

/**
 * The home a server response names, if it is a path on this site; otherwise
 * the fallback. Never follows an absolute or protocol-relative URL.
 */
export function localHome(value: unknown, fallback: string): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : fallback;
}
