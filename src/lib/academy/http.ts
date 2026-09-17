/**
 * Request helpers for academy API routes.
 *
 * Routes stay thin: authenticate with the central auth layer, read input
 * through these helpers, call a service, return JSON. Nothing here decides
 * identity or permissions.
 */
import { DomainError } from "./domain/errors.ts";

export const MAX_JSON_BYTES = 512_000;

/** Reads a JSON object body. Rejects non-objects, oversized and malformed bodies with a safe 400. */
export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_JSON_BYTES) {
    throw new DomainError("VALIDATION", "The request body is too large.");
  }
  const text = await req.text();
  if (text.length > MAX_JSON_BYTES) throw new DomainError("VALIDATION", "The request body is too large.");
  let parsed: unknown;
  try {
    parsed = text.length === 0 ? {} : JSON.parse(text);
  } catch {
    throw new DomainError("VALIDATION", "The request body must be valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new DomainError("VALIDATION", "The request body must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

/** The `action` of a command-style PATCH body, checked against the allowed list. */
export function readAction<A extends string>(body: Record<string, unknown>, allowed: readonly A[]): A {
  const action = body.action;
  if (typeof action !== "string" || !(allowed as readonly string[]).includes(action)) {
    throw new DomainError("VALIDATION", `action must be one of: ${allowed.join(", ")}.`);
  }
  return action as A;
}

export function readBooleanParam(req: Request, name: string): boolean {
  return new URL(req.url).searchParams.get(name) === "true";
}

export function readStringParam(req: Request, name: string): string | null {
  const value = new URL(req.url).searchParams.get(name);
  return value === null || value === "" ? null : value;
}

/**
 * Responses carrying time-gated or private data (Lesson Sheets, annotations,
 * preparation notes) must never be stored by shared caches or the browser.
 */
export const PRIVATE_NO_STORE: Readonly<Record<string, string>> = Object.freeze({ "Cache-Control": "private, no-store" });

/** Headers for a 429 response: private, not storable, with Retry-After. */
export function rateLimitHeaders(retryAfterSeconds: number): Record<string, string> {
  return { ...PRIVATE_NO_STORE, "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))) };
}

const CORRELATION_ID = /^[A-Za-z0-9._:-]{8,128}$/;

/** Optional client-supplied correlation id for grouping audit events. Invalid values are ignored. */
export function readCorrelationId(req: Request): string | null {
  const value = req.headers.get("x-correlation-id");
  return value && CORRELATION_ID.test(value) ? value : null;
}
