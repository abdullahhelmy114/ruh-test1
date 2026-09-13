/**
 * Upload and file-serving boundary (Phase 3 batch 2). Dependency-free
 * (node:path only) so it is unit-testable.
 *
 * The rules here are the single source of truth for BOTH the write side
 * (POST /api/upload, src/lib/upload-file.ts) and the read side
 * (GET /api/uploads/[...path]):
 *   - folders are a closed allowlist, never a client-supplied path
 *   - file types are allowlisted by extension AND MIME type, and the two
 *     must agree; no HTML, SVG, script or executable types are accepted
 *   - stored filenames are server-generated (uuid + allowlisted extension)
 *   - every filesystem path is resolved and proven to stay inside the root
 *     with a separator-aware check
 *   - served files carry a fixed content type, `nosniff`, and are delivered
 *     as attachments unless the type is known-safe to render inline
 */
import path from "node:path";

/**
 * Folder categories the application actually uses: the two directories
 * present in the deployed upload root (course-thumbnails, course-videos)
 * plus the route's historical default (general). Anything else is rejected.
 */
export const ALLOWED_UPLOAD_FOLDERS: ReadonlySet<string> = new Set([
  "general",
  "course-thumbnails",
  "course-videos",
]);

/** 100 MB: covers the course-video use case while bounding memory (the route buffers the body). */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

interface TypeRule {
  mimes: readonly string[];
  /** Safe to render inline in a browser (images, PDF, video); others are attachments. */
  inline: boolean;
}

/** Extension → accepted MIME types. Mirrors the formats the serving route was built to deliver. */
export const ALLOWED_TYPES: Readonly<Record<string, TypeRule>> = {
  ".pdf": { mimes: ["application/pdf"], inline: true },
  ".png": { mimes: ["image/png"], inline: true },
  ".jpg": { mimes: ["image/jpeg"], inline: true },
  ".jpeg": { mimes: ["image/jpeg"], inline: true },
  ".gif": { mimes: ["image/gif"], inline: true },
  ".webp": { mimes: ["image/webp"], inline: true },
  ".mp4": { mimes: ["video/mp4"], inline: true },
  ".mov": { mimes: ["video/quicktime"], inline: true },
  ".avi": { mimes: ["video/x-msvideo", "video/avi"], inline: false },
  ".mkv": { mimes: ["video/x-matroska"], inline: false },
  ".doc": { mimes: ["application/msword"], inline: false },
  ".docx": {
    mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    inline: false,
  },
};

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** True only for an exact, literal member of the folder allowlist. */
export function isAllowedFolder(folder: unknown): folder is string {
  return typeof folder === "string" && ALLOWED_UPLOAD_FOLDERS.has(folder);
}

/**
 * A single path segment that can never traverse: no separators (either
 * style), no `.`/`..`, no null bytes, no leading dot, bounded length.
 */
export function isSafeSegment(segment: unknown): segment is string {
  if (typeof segment !== "string" || !SAFE_SEGMENT.test(segment)) return false;
  if (segment === "." || segment === ".." || segment.includes("\0")) return false;
  return true;
}

export type UploadCheck =
  | { ok: true; ext: string; mime: string }
  | { ok: false; status: 400 | 413 | 415; reason: string };

/**
 * Validates a client-supplied file descriptor. Both the extension and the
 * declared MIME type must be allowlisted and must agree with each other.
 */
export function validateUpload(file: { name: unknown; type: unknown; size: unknown }): UploadCheck {
  const name = typeof file.name === "string" ? file.name : "";
  const size = typeof file.size === "number" ? file.size : Number.NaN;
  const mime = typeof file.type === "string" ? file.type.toLowerCase().split(";")[0].trim() : "";

  if (!Number.isFinite(size) || size <= 0) return { ok: false, status: 400, reason: "Empty file" };
  if (size > MAX_UPLOAD_BYTES) return { ok: false, status: 413, reason: "File too large" };

  const ext = path.extname(name).toLowerCase();
  const rule = ext ? ALLOWED_TYPES[ext] : undefined;
  if (!rule) return { ok: false, status: 415, reason: "File type not allowed" };
  if (!rule.mimes.includes(mime)) return { ok: false, status: 415, reason: "File type not allowed" };

  return { ok: true, ext, mime };
}

/** Server-generated stored name: never derived from the client filename. */
export function buildStoredFileName(uuid: string, ext: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(uuid)) throw new Error("invalid uuid");
  if (!ALLOWED_TYPES[ext]) throw new Error("extension not allowed");
  return `${uuid}${ext}`;
}

/**
 * Resolves `segments` under `root` and returns the absolute path only if it
 * is the root itself or strictly below it (separator-aware). Any unsafe
 * segment, or a resolved path outside the root, yields null.
 */
export function resolveWithinRoot(root: string, segments: readonly unknown[]): string | null {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  for (const s of segments) if (!isSafeSegment(s)) return null;
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...(segments as string[]));
  if (target === resolvedRoot) return null; // a directory, never a file to serve/write
  return target.startsWith(resolvedRoot + path.sep) ? target : null;
}

export interface ServePolicy {
  contentType: string;
  /** `inline` for browser-renderable media, otherwise `attachment`. */
  disposition: "inline" | "attachment";
}

/** Serving policy for a stored file, or null when the extension is not served at all. */
export function servePolicyFor(fileName: string): ServePolicy | null {
  const ext = path.extname(fileName).toLowerCase();
  const rule = ALLOWED_TYPES[ext];
  if (!rule) return null;
  return { contentType: rule.mimes[0], disposition: rule.inline ? "inline" : "attachment" };
}

/**
 * Server-generated temporary file path (Phase 3 closure fix F1).
 *
 * Deliberately takes NO client-supplied name: the only variable component is
 * the caller's uuid and an allowlisted extension, so a multipart filename can
 * never influence where the file lands. The result is proven to be directly
 * inside `root` (no traversal, no sibling-prefix bypass) or an error is thrown.
 */
export function serverTempFilePath(root: string, uuid: string, ext: string): string {
  const name = buildStoredFileName(uuid, ext);
  const target = resolveWithinRoot(root, [name]);
  if (!target || path.dirname(target) !== path.resolve(root)) {
    throw new Error("temp path escaped its root");
  }
  return target;
}
