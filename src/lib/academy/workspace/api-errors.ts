/**
 * How the workspace screens read a failed academy API response.
 *
 * The server is the only authority: this mapping only chooses what to show.
 * Authorization refusals from the central auth layer carry `code:
 * "FORBIDDEN"`; the only other 403 the academy sends is time-gated content
 * the caller is entitled to but cannot open yet (the Lesson Sheet release
 * rule, assessments that have not opened).
 */

export type FailureKind =
  | "unauthenticated"
  | "forbidden"
  | "not_yet"
  | "not_found"
  | "conflict"
  | "invalid"
  | "rate_limited"
  | "unavailable"
  | "network"
  | "server";

export interface ApiFailure {
  readonly kind: FailureKind;
  readonly status: number;
  /** A message the server marked as safe to show (validation and conflict details), when useful. */
  readonly message: string | null;
}

function serverMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const value = (body as { error?: unknown }).error;
  return typeof value === "string" && value.trim() !== "" && value.length <= 500 ? value : null;
}

export function failureFromResponse(status: number, body: unknown): ApiFailure {
  const code = body && typeof body === "object" ? (body as { code?: unknown }).code : undefined;
  const message = serverMessage(body);
  switch (true) {
    case status === 401:
      return { kind: "unauthenticated", status, message: null };
    case status === 403 && code === "FORBIDDEN":
      return { kind: "forbidden", status, message: null };
    case status === 403:
      return { kind: "not_yet", status, message };
    case status === 404:
      return { kind: "not_found", status, message: null };
    case status === 409:
      return { kind: "conflict", status, message };
    case status === 400 || status === 413 || status === 422:
      return { kind: "invalid", status, message };
    case status === 429:
      return { kind: "rate_limited", status, message: null };
    case status === 503:
      return { kind: "unavailable", status, message };
    default:
      return { kind: "server", status, message: null };
  }
}

export const NETWORK_FAILURE: ApiFailure = Object.freeze({ kind: "network", status: 0, message: null });

/** The `data` member of a successful academy response. */
export function dataOf<T>(body: unknown): T {
  if (!body || typeof body !== "object" || !("data" in body)) {
    throw new Error("Unexpected response shape.");
  }
  return (body as { data: T }).data;
}
