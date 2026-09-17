/**
 * Direct-to-Cloudinary upload purposes (Phase 3 closure fix F2).
 *
 * Client-safe and dependency-free: this module carries NO credentials. It is
 * the single source of truth, shared by the browser (pre-flight validation)
 * and the signing route (server-chosen parameters), for what each upload
 * purpose is allowed to be. The browser never chooses folder, resource type
 * or formats; it only names a purpose.
 *
 * Policy is derived from the existing teacher-signup UX: the CV input accepts
 * .pdf up to 10 MB and the intro-video input accepts mp4/quicktime/webm up to
 * 50 MB (src/components/academy/workspace/teacher/application-form.tsx).
 */

export type UploadPurpose = "teacher_cv" | "teacher_intro_video";

export interface UploadPurposePolicy {
  /** Cloudinary resource type segment of the upload URL and a signed-side constant. */
  resourceType: "raw" | "video";
  /** Server-chosen folder (signed). */
  folder: string;
  /** Accepted browser MIME types (client and server pre-check). */
  mimes: readonly string[];
  /** Cloudinary `allowed_formats` value (signed) — must match the purpose's console preset. */
  allowedFormats: string;
  /** Accepted lower-case extensions (defence in depth alongside MIME). */
  extensions: readonly string[];
  /**
   * Client-side UX pre-check only. The authoritative byte-size ceiling is
   * the purpose's SIGNED Cloudinary upload preset (configured in the console
   * with the same value); the signed request parameters carry no size field.
   */
  maxBytes: number;
  /**
   * Suffix appended to the server-generated random public ID. Raw assets
   * (the PDF CV) carry their extension in the public ID so the delivered
   * URL keeps ".pdf"; video public IDs carry no extension.
   */
  publicIdSuffix: "" | ".pdf";
  /**
   * Cloudinary delivery type (signed). Application documents are
   * "authenticated": they cannot be fetched by URL alone, only through a
   * short-lived signed download link the server issues to administrators.
   */
  deliveryType: "authenticated";
}

export const UPLOAD_PURPOSES: Readonly<Record<UploadPurpose, UploadPurposePolicy>> = {
  teacher_cv: {
    resourceType: "raw",
    folder: "teacher-signup/cv",
    mimes: ["application/pdf"],
    allowedFormats: "pdf",
    extensions: [".pdf"],
    maxBytes: 10 * 1024 * 1024,
    publicIdSuffix: ".pdf",
    deliveryType: "authenticated",
  },
  teacher_intro_video: {
    resourceType: "video",
    folder: "teacher-signup/videos",
    mimes: ["video/mp4", "video/quicktime", "video/webm"],
    allowedFormats: "mp4,mov,webm",
    extensions: [".mp4", ".mov", ".webm"],
    maxBytes: 50 * 1024 * 1024,
    publicIdSuffix: "",
    deliveryType: "authenticated",
  },
};

export function isUploadPurpose(value: unknown): value is UploadPurpose {
  return value === "teacher_cv" || value === "teacher_intro_video";
}

export type FileCheck = { ok: true } | { ok: false; reason: "type" | "size" | "empty" };

/**
 * Pre-flight check run in the browser BEFORE any signature is requested and
 * again conceptually mirrored by Cloudinary's signed `allowed_formats`.
 * Both the declared MIME type and the extension must be on the allowlist.
 */
export function checkFileForPurpose(
  file: { name: unknown; type: unknown; size: unknown },
  purpose: UploadPurpose
): FileCheck {
  const policy = UPLOAD_PURPOSES[purpose];
  const size = typeof file.size === "number" ? file.size : Number.NaN;
  if (!Number.isFinite(size) || size <= 0) return { ok: false, reason: "empty" };
  if (size > policy.maxBytes) return { ok: false, reason: "size" };
  const type = typeof file.type === "string" ? file.type.toLowerCase().split(";")[0].trim() : "";
  const name = typeof file.name === "string" ? file.name.toLowerCase() : "";
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot) : "";
  if (!policy.mimes.includes(type) || !policy.extensions.includes(ext)) return { ok: false, reason: "type" };
  return { ok: true };
}

/** Direct upload endpoint for a purpose (cloud name is public, non-secret). */
export function cloudinaryUploadUrl(cloudName: string, purpose: UploadPurpose): string {
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${UPLOAD_PURPOSES[purpose].resourceType}/upload`;
}
