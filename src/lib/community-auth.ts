import { HttpError, requireStudent } from "@/lib/auth";
import { sql } from "@/lib/db/client";

export type CommunityGender = "male" | "female";

/** The gender stored on the account's profile, which decides its community space. */
export async function communityGenderOf(uid: string): Promise<CommunityGender | null> {
  const [row] = await sql`SELECT gender FROM profiles WHERE firebase_uid = ${uid}`;
  return row?.gender === "male" || row?.gender === "female" ? row.gender : null;
}

/**
 * A member of the student community: a signed-in student (central auth, from
 * the session cookie or bearer token) whose profile states a gender. The
 * community space is taken from the stored profile, never from the request.
 *
 * The community routes used to verify a "session" cookie the application
 * never sets and read role and gender from token claims it never issues, so
 * every signed-in student was refused.
 */
export async function requireCommunityMember(req: Request): Promise<{ readonly uid: string; readonly gender: CommunityGender }> {
  const user = await requireStudent(req);
  const gender = await communityGenderOf(user.uid);
  if (!gender) throw new HttpError(403, "Add your gender to your profile to join the community.");
  return { uid: user.uid, gender };
}
