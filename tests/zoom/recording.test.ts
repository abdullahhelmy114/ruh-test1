/**
 * Phase 3 batch 1 follow-up — Zoom recording.completed identifier and file
 * selection helpers (pure).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  extractDownloadToken,
  normalizeZoomMeetingId,
  pickRecordingFile,
} from "../../src/lib/zoom/recording.ts";

describe("normalizeZoomMeetingId", () => {
  test("numeric meeting id (Zoom's payload.object.id) becomes the digit string stored in lessons.meeting_id", () => {
    assert.equal(normalizeZoomMeetingId(83456789012), "83456789012");
    assert.equal(normalizeZoomMeetingId(1), "1");
  });

  test("string digit ids are accepted and trimmed (matches String(zoomResponse.id))", () => {
    assert.equal(normalizeZoomMeetingId("83456789012"), "83456789012");
    assert.equal(normalizeZoomMeetingId(" 123 "), "123");
  });

  test("wrong identifiers are rejected: uuids, lesson ids, floats, negatives, empty, objects", () => {
    assert.equal(normalizeZoomMeetingId("abc"), null);
    assert.equal(normalizeZoomMeetingId("00000000-0000-4000-8000-000000000000"), null);
    assert.equal(normalizeZoomMeetingId("12 34"), null);
    assert.equal(normalizeZoomMeetingId(1.5), null);
    assert.equal(normalizeZoomMeetingId(-5), null);
    assert.equal(normalizeZoomMeetingId(0), null);
    assert.equal(normalizeZoomMeetingId(Number.NaN), null);
    assert.equal(normalizeZoomMeetingId(""), null);
    assert.equal(normalizeZoomMeetingId(null), null);
    assert.equal(normalizeZoomMeetingId(undefined), null);
    assert.equal(normalizeZoomMeetingId({ id: 1 }), null);
    assert.equal(normalizeZoomMeetingId("1".repeat(21)), null);
  });
});

describe("pickRecordingFile", () => {
  const mp4Speaker = { file_type: "MP4", recording_type: "shared_screen_with_speaker_view", download_url: "https://us02web.zoom.us/rec/download/speaker" };
  const mp4Gallery = { file_type: "MP4", recording_type: "gallery_view", download_url: "https://us02web.zoom.us/rec/download/gallery" };
  const audio = { file_type: "M4A", recording_type: "audio_only", download_url: "https://us02web.zoom.us/rec/download/audio" };

  test("prefers the MP4 speaker view", () => {
    assert.deepEqual(pickRecordingFile([audio, mp4Gallery, mp4Speaker]), { downloadUrl: mp4Speaker.download_url });
  });

  test("falls back to any MP4, then to the first file", () => {
    assert.deepEqual(pickRecordingFile([audio, mp4Gallery]), { downloadUrl: mp4Gallery.download_url });
    assert.deepEqual(pickRecordingFile([audio]), { downloadUrl: audio.download_url });
  });

  test("missing download URL, empty list, or malformed input yields null", () => {
    assert.equal(pickRecordingFile([{ file_type: "MP4", recording_type: "shared_screen_with_speaker_view" }]), null);
    assert.equal(pickRecordingFile([{ file_type: "MP4", download_url: "" }]), null);
    assert.equal(pickRecordingFile([]), null);
    assert.equal(pickRecordingFile(undefined), null);
    assert.equal(pickRecordingFile("nope"), null);
    assert.equal(pickRecordingFile([null, 5]), null);
  });
});

describe("extractDownloadToken", () => {
  test("reads the top-level download_token string only", () => {
    assert.equal(extractDownloadToken({ event: "recording.completed", download_token: "tok" }), "tok");
    assert.equal(extractDownloadToken({ event: "recording.completed", download_token: "" }), null);
    assert.equal(extractDownloadToken({ event: "recording.completed", download_token: 5 }), null);
    assert.equal(extractDownloadToken({ payload: { download_token: "nested" } }), null);
    assert.equal(extractDownloadToken(null), null);
  });
});
