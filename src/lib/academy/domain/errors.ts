/**
 * Domain errors for the academy core.
 *
 * DomainError extends the existing HttpError, so every academy failure flows
 * through the same `toErrorResponse` / `withApi` path as the rest of the API:
 * the status and message reach the client, internals never do. Messages passed
 * here must therefore be safe to show to an end user.
 *
 * Permission denials are NOT DomainErrors: they are AuthError("FORBIDDEN")
 * from the central auth core, so there is exactly one way to say "forbidden".
 */
import { HttpError } from "../../auth/core.ts";

export type DomainErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "IMMUTABLE"
  | "APPROVAL_REQUIRED"
  | "POLICY_UNCONFIGURED"
  | "FEATURE_UNAVAILABLE";

const STATUS_BY_CODE: Readonly<Record<DomainErrorCode, number>> = {
  VALIDATION: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_TRANSITION: 409,
  IMMUTABLE: 409,
  APPROVAL_REQUIRED: 409,
  POLICY_UNCONFIGURED: 503,
  FEATURE_UNAVAILABLE: 503,
};

export class DomainError extends HttpError {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(STATUS_BY_CODE[code], message);
    this.name = "DomainError";
    this.code = code;
  }
}

export function statusForDomainCode(code: DomainErrorCode): number {
  return STATUS_BY_CODE[code];
}

/** Requires a non-empty, bounded, trimmed reason. Returns the trimmed text. */
export function requireReason(reason: unknown, maxLength = 2000): string {
  if (typeof reason !== "string") {
    throw new DomainError("VALIDATION", "A reason is required.");
  }
  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    throw new DomainError("VALIDATION", "A reason is required.");
  }
  if (trimmed.length > maxLength) {
    throw new DomainError("VALIDATION", `The reason must be at most ${maxLength} characters.`);
  }
  return trimmed;
}

/** Normalises an optional reason: undefined/blank -> null, otherwise bounded text. */
export function optionalReason(reason: unknown, maxLength = 2000): string | null {
  if (reason === undefined || reason === null) return null;
  if (typeof reason !== "string") {
    throw new DomainError("VALIDATION", "The reason must be text.");
  }
  const trimmed = reason.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLength) {
    throw new DomainError("VALIDATION", `The reason must be at most ${maxLength} characters.`);
  }
  return trimmed;
}
