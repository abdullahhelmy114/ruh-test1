/**
 * Pure helpers for the Zoom `recording.completed` → YouTube pipeline
 * (Phase 3 batch 1 follow-up). Dependency-free so they are unit-testable.
 *
 * Identifier model (traced from the repository):
 *   - `lessons.id` is a UUID.
 *   - `lessons.meeting_id` stores the Zoom MEETING id as text; it is written
 *     by the admin approval route from `String(zoomResponse.id)`.
 *   - Zoom sends `payload.object.id` as the numeric meeting id (int64), so the
 *     webhook must normalise it to the same digit string and resolve
 *     meeting_id → lessons.id before calling the upload route.
 */

/** Zoom meeting id as the digit string stored in lessons.meeting_id, or null. */
export function normalizeZoomMeetingId(value: unknown): string | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) return null;
    return String(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return /^[0-9]{1,20}$/.test(trimmed) ? trimmed : null;
  }
  return null;
}

export interface ZoomRecordingFile {
  file_type?: unknown;
  recording_type?: unknown;
  download_url?: unknown;
}

/**
 * Picks the recording file to upload: the MP4 speaker view if present, else
 * any MP4, else the first file (the pre-existing fallback). Returns null when
 * there is no file with a string download_url.
 */
export function pickRecordingFile(files: unknown): { downloadUrl: string } | null {
  if (!Array.isArray(files)) return null;
  const withUrl = files.filter(
    (f): f is ZoomRecordingFile & { download_url: string } =>
      !!f && typeof f === "object" && typeof (f as ZoomRecordingFile).download_url === "string" && !!(f as ZoomRecordingFile).download_url
  );
  if (withUrl.length === 0) return null;
  const preferred =
    withUrl.find((f) => f.file_type === "MP4" && f.recording_type === "shared_screen_with_speaker_view") ??
    withUrl.find((f) => f.file_type === "MP4") ??
    withUrl[0];
  return { downloadUrl: preferred.download_url };
}

/** Zoom's short-lived download token, sent at the top level of the event body. */
export function extractDownloadToken(body: unknown): string | null {
  const token = (body as { download_token?: unknown } | null)?.download_token;
  return typeof token === "string" && token.length > 0 ? token : null;
}
