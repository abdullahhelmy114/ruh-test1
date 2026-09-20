/**
 * What the sign-in exchange may conclude from the profile row of a verified
 * Firebase identity.
 *
 * A verified Firebase token proves who the caller is; it does not make them an
 * account holder. Profiles are created by the sign-up routes only, so an
 * identity that completed a Firebase sign-in without ever registering - a
 * Google or Facebook popup, an account created straight in the Firebase
 * console, or one whose profile was removed - has no row here.
 *
 * Before this module the exchange answered such a caller with a fourteen-day
 * session cookie and the invented role "student". The server then refused
 * every request, because getSession() resolves the caller from profiles and
 * returns null without one (src/lib/auth/core.ts). The browser believed it was
 * signed in and nothing worked.
 *
 * So: no profile, no session. The decision is a pure function of the row, kept
 * apart from the route so every case can be tested without Firebase or a
 * database. It never invents a role, and it never promotes anyone: the role and
 * status are whatever the row says, and the destination follows the shared
 * accountHome rule.
 */
import { accountHome } from "./home.ts";

/** The columns the exchange reads. Anything else in the row is ignored. */
export interface SessionProfileRow {
  readonly role?: unknown;
  readonly status?: unknown;
}

export type SessionDecision =
  | {
      readonly outcome: "established";
      /** The stored role, or null when the row does not name one. Never invented. */
      readonly role: string | null;
      readonly status: string | null;
      readonly home: string;
    }
  | {
      readonly outcome: "no_account";
      /** A machine-readable reason for the client; it carries no account detail. */
      readonly reason: "no_profile";
    };

const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

/**
 * `row` is the profiles row for the verified uid, or undefined when there is none.
 * Only an "established" decision may set a session cookie.
 */
export function decideSession(row: SessionProfileRow | undefined | null): SessionDecision {
  if (!row) return { outcome: "no_account", reason: "no_profile" };
  const role = str(row.role);
  const status = str(row.status);
  return { outcome: "established", role, status, home: accountHome(role, status) };
}
