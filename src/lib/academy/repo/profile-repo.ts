/**
 * Read-only access to the existing `profiles` table.
 *
 * Profiles remain the single identity record (keyed by Firebase uid). The
 * academy core only reads the role and account status it needs to validate
 * teacher assignments and enrollments. It never writes to this table.
 */
import type { Role } from "../../auth/core.ts";
import { isUid } from "../domain/ids.ts";
import { sqlQuery, type SqlQuery, type SqlRow } from "../infra/sql.ts";
import type { ProfileFacts } from "../structure/delivery.ts";

export function selectProfileFactsQuery(uid: string): SqlQuery {
  return sqlQuery`SELECT firebase_uid, role, status FROM profiles WHERE firebase_uid = ${uid}`;
}

/** Role, status and display name of several accounts (for showing assigned teachers to administrators). */
export function selectProfilesFactsQuery(uids: readonly string[]): SqlQuery {
  return { text: `SELECT firebase_uid, role, status, full_name FROM profiles WHERE firebase_uid = ANY($1::text[])`, values: [[...uids]] };
}

const ROLES: readonly Role[] = ["admin", "teacher", "student"];

/** Maps a profile row. Unknown roles map to null: such an account cannot be assigned or enrolled. */
export function mapProfileFacts(row: SqlRow | undefined): ProfileFacts | null {
  if (!row || !isUid(row.firebase_uid)) return null;
  const role = row.role;
  if (typeof role !== "string" || !(ROLES as readonly string[]).includes(role)) return null;
  return Object.freeze({
    uid: row.firebase_uid as string,
    role: role as Role,
    status: typeof row.status === "string" ? row.status : null,
  });
}
