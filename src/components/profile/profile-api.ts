import { authFetch } from "@/lib/authFetch";

/** The signed-in account's stored profile row (fields the profile screens read). */
export interface StoredProfile {
  readonly full_name?: string | null;
  readonly email?: string | null;
  readonly role?: string | null;
  readonly status?: string | null;
  readonly gender?: string | null;
  readonly nationality?: string | null;
  readonly country_of_residence?: string | null;
  readonly whatsapp?: string | null;
  readonly telegram?: string | null;
  readonly bio?: string | null;
  readonly languages?: unknown;
  readonly social_links?: unknown;
}

export type ProfileResult<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly message: string };

/** Loads the signed-in account's own profile. Never falls back to browser storage. */
export async function loadOwnProfile(): Promise<ProfileResult<StoredProfile>> {
  try {
    const res = await authFetch("/api/user");
    const body = await res.json().catch(() => null);
    if (res.ok && body?.profile) return { ok: true, data: body.profile as StoredProfile };
    return { ok: false, message: "Your profile could not be loaded." };
  } catch {
    return { ok: false, message: "Your profile could not be loaded. Check your connection and try again." };
  }
}

/**
 * Saves profile fields through PATCH /api/user. Success is reported only when
 * the server stored them; its message is shown otherwise.
 */
export async function saveOwnProfile(changes: Readonly<Record<string, unknown>>): Promise<ProfileResult<null>> {
  try {
    const res = await authFetch("/api/user", { method: "PATCH", body: JSON.stringify(changes) });
    if (res.ok) return { ok: true, data: null };
    const body = await res.json().catch(() => null);
    return { ok: false, message: typeof body?.error === "string" ? body.error : "Your profile was not saved." };
  } catch {
    return { ok: false, message: "Your profile was not saved. Check your connection and try again." };
  }
}

/** Language codes from the stored languages value ([{ code, proficiency }] or plain strings). */
export function languageCodes(value: unknown): string[] {
  let list: unknown = value;
  if (typeof value === "string") {
    try {
      list = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(list)
    ? list.map((entry) => (typeof entry === "string" ? entry : entry && typeof entry === "object" && typeof (entry as { code?: unknown }).code === "string" ? (entry as { code: string }).code : "")).filter(Boolean)
    : [];
}

/** Profile links from the stored value. */
export function storedLinks(value: unknown): { platform: string; url: string }[] {
  let list: unknown = value;
  if (typeof value === "string") {
    try {
      list = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(list)
    ? list
        .filter((entry): entry is { platform: unknown; url: unknown } => Boolean(entry) && typeof entry === "object")
        .map((entry) => ({ platform: typeof entry.platform === "string" ? entry.platform : "", url: typeof entry.url === "string" ? entry.url : "" }))
    : [];
}
