/**
 * Phase 3 batch 1 — static guards for the internal trust boundary and the
 * public data projections. Behavioural checks of the primitives live in
 * internal-auth.test.ts; these tests pin the wiring in the route files.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const ROOT = join(import.meta.dirname, "..", "..", "src");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const code = (rel: string) => read(rel).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

describe("upload-youtube is internal-only", () => {
  const src = code("app/api/lessons/[id]/upload-youtube/route.ts");

  test("single POST handler wrapped in withApi, no legacy export", () => {
    assert.equal((src.match(/^export const POST = withApi/gm) ?? []).length, 1);
    assert.equal((src.match(/^export (async )?function POST/gm) ?? []).length, 0);
  });

  test("requires the internal secret before reading params or the database, failing closed", () => {
    const guard = src.indexOf("checkInternalSecret(request, process.env.INTERNAL_API_SECRET)");
    assert.ok(guard > 0, "checkInternalSecret call missing");
    assert.ok(guard < src.indexOf("await context.params"), "guard must run before params");
    assert.ok(guard < src.indexOf("FROM lessons"), "guard must run before the DB read");
    assert.ok(src.includes("=== 'unconfigured') throw new HttpError(503"), "must fail closed when unconfigured");
    assert.ok(src.includes("!== 'ok') throw new AuthError('UNAUTHORIZED'"), "must reject anything but an exact match");
  });

  test("never trusts user identity headers or client-supplied ids", () => {
    for (const needle of ["x-user-id", "x-user-role", "requireAdmin", "requireTeacher", "body.userId", "body.uid"]) {
      assert.equal(src.includes(needle), false, `unexpected ${needle}`);
    }
  });

  test("replay guard and Zoom-host restriction are wired; no error.message leak", () => {
    assert.ok(src.includes("isYouTubeUrl(lesson.recording_url)"));
    assert.ok(src.includes("isAllowedRecordingUrl(recordingUrl)"));
    assert.equal(src.includes("error.message"), false);
  });
});

describe("Zoom webhook verifies Zoom signatures and forwards the internal secret", () => {
  const src = code("app/api/webhooks/zoom/route.ts");

  test("fails closed without ZOOM_WEBHOOK_SECRET_TOKEN and verifies before parsing", () => {
    assert.ok(src.includes("process.env.ZOOM_WEBHOOK_SECRET_TOKEN"));
    const verify = src.indexOf("verifyZoomSignature(");
    assert.ok(verify > 0);
    assert.ok(verify < src.indexOf("JSON.parse(rawBody)"), "signature check must precede JSON parsing");
    assert.ok(src.includes("endpoint.url_validation"));
  });

  test("internal call carries the internal secret header and nothing user-derived", () => {
    assert.ok(src.includes("[INTERNAL_SECRET_HEADER]: internalSecret"));
    assert.ok(src.includes("process.env.INTERNAL_API_SECRET"));
    assert.equal(src.includes("x-user-"), false);
  });

  test("resolves Zoom's numeric meeting id to lessons.id before the internal call (follow-up fix)", () => {
    assert.ok(src.includes("normalizeZoomMeetingId(payload?.object?.id)"), "meeting id must be normalised (number or string)");
    assert.equal(src.includes("typeof lessonId === 'string'"), false, "old string-only gate must be gone");
    const lookup = src.indexOf("WHERE meeting_id = ${meetingId}");
    assert.ok(lookup > 0, "must look the lesson up by meeting_id");
    assert.ok(lookup > src.indexOf("verifyZoomSignature("), "lookup only after signature verification");
    assert.ok(lookup < src.indexOf("fetch(uploadApiUrl"), "lookup must precede the internal call");
    assert.ok(src.includes("encodeURIComponent(String(lesson.id))"), "internal call must target lessons.id");
    assert.ok(src.includes("recordingUrl: recordingFile.downloadUrl"), "verified download URL is passed through");
    assert.ok(src.includes("downloadToken: extractDownloadToken(body)"), "Zoom download token is passed through");
    assert.equal((src.match(/request\.text\(\)/g) ?? []).length, 1, "raw body read exactly once");
    assert.equal(src.includes("request.json()"), false, "no second body read");
  });
});

describe("upload-youtube reads the recording URL from the trusted caller with the same allowlist", () => {
  const src = code("app/api/lessons/[id]/upload-youtube/route.ts");

  test("body is read once, after the internal secret check, and the URL still passes the Zoom allowlist", () => {
    const guard = src.indexOf("checkInternalSecret(request, process.env.INTERNAL_API_SECRET)");
    const bodyRead = src.indexOf("await request.json()");
    assert.ok(bodyRead > guard, "body must be read only after the internal secret check");
    assert.equal((src.match(/request\.json\(\)/g) ?? []).length, 1, "body read exactly once");
    assert.ok(src.includes("bodyRecordingUrl ?? (lesson.recording_url || null)"), "body URL first, DB fallback");
    const allow = src.indexOf("isAllowedRecordingUrl(recordingUrl)");
    assert.ok(allow > 0 && allow < src.indexOf("await fetch(recordingUrl"), "allowlist before download");
    assert.ok(src.indexOf("Lesson not found") < allow, "lesson existence checked before using the body URL");
    assert.ok(src.includes("isYouTubeUrl(lesson.recording_url)"), "replay guard still keyed on the stored YouTube URL");
    assert.ok(src.includes("Authorization: `Bearer ${downloadToken}`"), "download token sent as bearer, never in the URL");
  });
});

describe("no other route reaches the YouTube upload without the boundary", () => {
  test("upload-youtube is only referenced by the Zoom webhook", () => {
    let out = "";
    try {
      out = execSync('git grep -l "upload-youtube" -- src', { cwd: join(ROOT, ".."), encoding: "utf8" });
    } catch (e: any) {
      out = e.stdout?.toString() ?? "";
    }
    const files = out.split(/\r?\n/).filter(Boolean).map((f) => f.replace(/\\/g, "/"));
    const allowed = new Set([
      "src/app/api/lessons/[id]/upload-youtube/route.ts",
      "src/app/api/webhooks/zoom/route.ts",
    ]);
    for (const f of files) assert.ok(allowed.has(f), `unexpected reference in ${f}`);
  });
});

describe("public projections", () => {
  test("academy-info has no SELECT * and no identifier/internal columns", () => {
    const src = code("app/api/academy-info/route.ts");
    assert.equal(/SELECT\s+\*/i.test(src), false);
    // Only the projected row queries are checked; the DISTINCT count of
    // enrollments.user_uid is an aggregate and returns no identifiers.
    const projections = src.match(/`SELECT[\s\S]*?FROM[\s\S]*?`/g) ?? [];
    assert.ok(projections.length >= 9, "expected one explicit projection per table");
    for (const q of projections) {
      for (const col of ["teacher_uid", "user_uid", "admin_uid", "admin_id", "chunk_text", "embedding", "recording_url", "payment_url", "scenario", "model_course_id", "content"]) {
        if (col === "content" && /FROM (static_pages|blog_posts)/.test(q)) continue; // public CMS body text
        assert.equal(q.includes(col), false, `academy-info must not select ${col}: ${q.trim().slice(0, 60)}`);
      }
    }
    assert.ok(src.includes("is_published = true"));
    assert.ok(src.includes("status = 'active'"));
  });

  test("teacher public profile excludes email, age, gender and contact fields", () => {
    const src = code("app/api/teacher/public/[uid]/route.ts");
    for (const col of ["email", "age", "gender", "whatsapp", "telegram", "cv_url", "fcm_token", "referral", "social_links"]) {
      assert.equal(new RegExp(`\\b${col}\\b`).test(src), false, `teacher/public must not return ${col}`);
    }
    assert.equal(src.includes("error.message"), false);
    assert.ok(src.includes("role = 'teacher'"));
  });

  test("teacher page no longer renders email, age or gender", () => {
    const src = code("app/teachers/[uid]/page.tsx");
    for (const needle of ["teacher.email", "teacher.age", "teacher.gender"]) {
      assert.equal(src.includes(needle), false, `page still renders ${needle}`);
    }
  });

  test("public course detail and reviews use explicit columns without uids", () => {
    const course = code("app/api/course/[id]/route.ts");
    assert.equal(/SELECT\s+c\.\*/i.test(course), false);
    for (const col of ["teacher_uid", "recording_url", "c.content", "model_course_id"]) {
      assert.equal(course.includes(col), false, `course/[id] must not select ${col}`);
    }
    const reviews = code("app/api/reviews/route.ts");
    assert.equal(/SELECT\s+r\.\*/i.test(reviews), false);
    assert.ok(reviews.includes("SELECT r.id, r.rating, r.comment, r.created_at, p.full_name AS user_name"));
    assert.equal(reviews.includes("error.message"), false);
  });
});
