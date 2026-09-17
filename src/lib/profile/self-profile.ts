/**
 * What a signed-in account may change about its own profile.
 *
 * Identity and access columns (firebase_uid, email, role, status,
 * email_verified, referral fields, notification tokens) are never accepted,
 * and fields a role may not change are refused rather than ignored, so a
 * screen can never believe it saved something the server dropped.
 *
 *   student         full name, gender, nationality, country of residence,
 *                   WhatsApp, Telegram
 *   administrator   full name, nationality, country of residence, WhatsApp,
 *                   Telegram
 *   active teacher  biography, WhatsApp, Telegram, profile links. Name,
 *                   nationality, gender and languages were reviewed with the
 *                   application and stay as approved.
 *   any other teacher account
 *                   nothing: its details are its application, revised on the
 *                   application page when the academy asks for changes.
 *
 * Values are validated with the same rules as the teacher application.
 * Dependency-light so it can be tested without a database.
 */
import { ACTIVE_ACCOUNT_STATUS, HttpError, type Role } from "../auth/core.ts";
import { DomainError } from "../academy/domain/errors.ts";
import { parseBio, parseGender, parseShortText, parseSocialLinks, parseTelegram, parseWhatsapp } from "../academy/teachers/applications.ts";

/** Profile columns this module writes, each proven by existing profile writes. */
export type ProfileColumn = "full_name" | "gender" | "nationality" | "country_of_residence" | "whatsapp" | "telegram" | "bio" | "social_links";

/** Request field → column and validator. Empty strings clear optional contact fields for students and administrators. */
const FIELDS = {
  fullName: { column: "full_name", parse: (v: unknown) => parseShortText(v, "fullName") },
  gender: { column: "gender", parse: parseGender },
  nationality: { column: "nationality", parse: (v: unknown) => parseShortText(v, "nationality") },
  countryOfResidence: { column: "country_of_residence", parse: (v: unknown) => parseShortText(v, "countryOfResidence") },
  whatsapp: { column: "whatsapp", parse: parseWhatsapp },
  telegram: { column: "telegram", parse: parseTelegram },
  bio: { column: "bio", parse: parseBio },
  socialLinks: { column: "social_links", parse: (v: unknown) => JSON.stringify(parseSocialLinks(v)) },
} as const satisfies Record<string, { readonly column: ProfileColumn; readonly parse: (value: unknown) => unknown }>;

export type ProfileField = keyof typeof FIELDS;

export const EDITABLE_FIELDS: Readonly<Record<"student" | "admin" | "teacher", readonly ProfileField[]>> = {
  student: ["fullName", "gender", "nationality", "countryOfResidence", "whatsapp", "telegram"],
  admin: ["fullName", "nationality", "countryOfResidence", "whatsapp", "telegram"],
  teacher: ["bio", "whatsapp", "telegram", "socialLinks"],
};

/** Contact fields a student or administrator may clear (teachers keep reachable contact details). */
const CLEARABLE: readonly ProfileField[] = ["gender", "nationality", "countryOfResidence", "whatsapp", "telegram"];

export const TEACHER_APPLICANT_MESSAGE = "Your details are part of your teacher application. Change them from your application page when the academy asks for changes.";

export interface ProfileUpdate {
  /** Columns and validated values, in a stable order. */
  readonly changes: readonly { readonly column: ProfileColumn; readonly value: string | null }[];
  /** The role and (for teachers) status the write must still match. */
  readonly expectedRole: Role;
  readonly requireActive: boolean;
}

/**
 * Plans a self-profile update. `role` and `status` are the stored account's
 * (never the request's). Throws HttpError 400 for invalid or disallowed
 * fields and 409 for a teacher account that is not active.
 */
export function planProfileUpdate(account: { readonly role: Role; readonly status: string | null | undefined }, body: unknown): ProfileUpdate {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Send the profile fields to change.");
  if (account.role === "teacher" && account.status !== ACTIVE_ACCOUNT_STATUS) throw new HttpError(409, TEACHER_APPLICANT_MESSAGE);

  const allowed = EDITABLE_FIELDS[account.role];
  const entries = Object.entries(body as Record<string, unknown>);
  if (entries.length === 0) throw new HttpError(400, "Send the profile fields to change.");

  const changes: { column: ProfileColumn; value: string | null }[] = [];
  for (const [name, value] of entries) {
    if (!(allowed as readonly string[]).includes(name)) {
      throw new HttpError(400, `${name} cannot be changed here.`);
    }
    const field = FIELDS[name as ProfileField];
    if (account.role !== "teacher" && CLEARABLE.includes(name as ProfileField) && (value === null || value === "")) {
      changes.push({ column: field.column, value: null });
      continue;
    }
    try {
      changes.push({ column: field.column, value: field.parse(value) as string });
    } catch (error) {
      if (error instanceof DomainError) throw new HttpError(400, error.message);
      throw error;
    }
  }
  const order = Object.values(FIELDS).map((f) => f.column as ProfileColumn);
  changes.sort((a, b) => order.indexOf(a.column) - order.indexOf(b.column));
  return { changes, expectedRole: account.role, requireActive: account.role === "teacher" };
}

/**
 * The UPDATE for a planned change: only the account's own row, only while it
 * still has the role (and, for teachers, the active status) the plan was made
 * for, so a concurrent role or status change turns the write into a conflict.
 * Column names come from the fixed list above; every value is a parameter.
 */
export function profileUpdateQuery(uid: string, plan: ProfileUpdate): { readonly text: string; readonly values: readonly (string | null)[] } {
  const sets = plan.changes.map((change, index) => `${change.column} = $${index + 1}`).join(", ");
  const n = plan.changes.length;
  return {
    text: `UPDATE profiles SET ${sets} WHERE firebase_uid = $${n + 1} AND role = $${n + 2}${plan.requireActive ? ` AND status = '${ACTIVE_ACCOUNT_STATUS}'` : ""} RETURNING firebase_uid`,
    values: [...plan.changes.map((change) => change.value), uid, plan.expectedRole],
  };
}
