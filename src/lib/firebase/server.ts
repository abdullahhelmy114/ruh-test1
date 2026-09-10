/**
 * Compatibility shim (Phase 1).
 *
 * `verifyIdToken(req)` is kept for the routes that still import it, but it
 * now delegates to the central auth service. Identity comes only from a
 * verified Firebase credential and role only from `profiles`. Returns
 * `{ uid, role, email }` or null, matching the previous shape.
 *
 * Deprecated: new code should use `requireAuth` / `requireRole` from
 * "@/lib/auth". Callers are migrated in Phase 2, after which this file is
 * removed.
 */
import { getSession } from "@/lib/auth";

export async function verifyIdToken(
  req: Request
): Promise<{ uid: string; role: string; email: string } | null> {
  const user = await getSession(req);
  if (!user) return null;
  return { uid: user.uid, role: user.role, email: user.email ?? "" };
}
