// لاحظ: لا نستخدم Edge Runtime هنا، لأننا نحتاج Node.js
export const runtime = 'nodejs'; // هذا يجعلها Function عادية على Netlify (AWS Lambda)

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { withApi } from '@/lib/api/handler';
import { AuthError, HttpError } from '@/lib/auth';
import { checkInternalSecret, isAllowedRecordingUrl } from '@/lib/security/internal-auth';

// Phase 3 batch 1 — trust boundary.
// This route has NO user-facing caller: its only caller is the Zoom
// recording webhook (src/app/api/webhooks/zoom), which is itself signature-
// verified and forwards the internal secret. It used to be reachable by
// anyone and would download a URL from the DB, upload it with the server's
// YouTube credentials and overwrite lessons.recording_url.
// Now:
//   - requires `x-internal-secret` (INTERNAL_API_SECRET; 503 if unset, 401 if wrong)
//   - never derives anything from user identity headers
//   - replay-safe: a lesson whose recording_url already points at YouTube is
//     not re-uploaded (Zoom retries deliveries)
//   - the server-side fetch is restricted to Zoom download hosts (no SSRF)
//   - no error.message is returned to the caller
// The YouTube upload logic itself is unchanged.
//
// Phase 3 batch 1 follow-up — recording source of truth.
// Nothing in the repository ever stored the Zoom download URL in
// `lessons.recording_url` (that column only ever receives the final YouTube
// URL, written below), so reading it as the download source could never
// work. The trusted internal caller (the signature-verified Zoom webhook) now
// passes `recordingUrl` and Zoom's short-lived `downloadToken` in the body.
// The body URL is subject to the same Zoom-host allowlist; `recording_url`
// remains as a fallback source for operator-triggered re-uploads.

// ── دوال مساعدة لـ YouTube ──────────────────────────
async function getYouTubeAccessToken(): Promise<string> {
  const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env;
  if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !YOUTUBE_REFRESH_TOKEN) {
    throw new Error('Missing YouTube OAuth credentials');
  }

  const params = new URLSearchParams({
    client_id: YOUTUBE_CLIENT_ID,
    client_secret: YOUTUBE_CLIENT_SECRET,
    refresh_token: YOUTUBE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube token refresh failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * رفع فيديو إلى YouTube كفيديو خاص.
 * @param title عنوان الفيديو
 * @param description وصف الفيديو
 * @param videoBuffer بيانات الفيديو (Buffer)
 * @returns معرف الفيديو على YouTube
 */
async function uploadToYouTube(
  title: string,
  description: string,
  videoBuffer: ArrayBuffer
): Promise<string> {
  const accessToken = await getYouTubeAccessToken();

  // بناء أجزاء الطلب (multipart upload)
  const metadata = {
    snippet: {
      title,
      description,
      categoryId: '22', // التعليم
    },
    status: {
      privacyStatus: 'private', // خاص
      selfDeclaredMadeForKids: false,
    },
  };

  const formData = new FormData();
  formData.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  formData.append('video', new Blob([videoBuffer]));

  // استدعاء YouTube API للرفع
  const res = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube upload failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.id; // YouTube Video ID
}

function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com');
  } catch {
    return false;
  }
}

// ── API Route Handler (internal only) ─────────────────────────────
export const POST = withApi<{ id: string }>(async (request, context) => {
  const internalCheck = checkInternalSecret(request, process.env.INTERNAL_API_SECRET);
  if (internalCheck === 'unconfigured') throw new HttpError(503, 'Internal authentication is not configured');
  if (internalCheck !== 'ok') throw new AuthError('UNAUTHORIZED', 'Invalid internal credentials');
  const { id: lessonId } = await context.params;
  if (!lessonId) throw new HttpError(400, 'Lesson id is required');

  // Body from the trusted internal caller (read once; optional).
  const body = await request.json().catch(() => ({}));
  const bodyRecordingUrl = typeof body?.recordingUrl === 'string' && body.recordingUrl ? body.recordingUrl : null;
  const downloadToken = typeof body?.downloadToken === 'string' && body.downloadToken ? body.downloadToken : null;

  try {
    // 1. الدرس المستهدف (lessons.id) وحالة التسجيل الحالية
    const [lesson] = await sql`
      SELECT recording_url, title FROM lessons WHERE id = ${lessonId}
    `;

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Replay / duplicate delivery: already migrated to YouTube.
    if (typeof lesson.recording_url === 'string' && isYouTubeUrl(lesson.recording_url)) {
      return NextResponse.json({ success: true, alreadyProcessed: true, url: lesson.recording_url });
    }

    // رابط تنزيل Zoom: من النداء الداخلي الموثوق أولاً، ثم من قاعدة البيانات
    const recordingUrl: string | null = bodyRecordingUrl ?? (lesson.recording_url || null);
    if (!recordingUrl) {
      return NextResponse.json({ error: 'No recording URL available' }, { status: 400 });
    }

    if (!isAllowedRecordingUrl(recordingUrl)) {
      return NextResponse.json({ error: 'Recording URL is not a Zoom download URL' }, { status: 400 });
    }

    // 2. تنزيل الفيديو من Zoom (download_token يُرسل كـ Bearer عند توفره)
    const videoRes = await fetch(recordingUrl, {
      headers: downloadToken ? { Authorization: `Bearer ${downloadToken}` } : undefined,
    });
    if (!videoRes.ok) {
      throw new Error(`Failed to download video from Zoom: ${videoRes.status}`);
    }
    const videoBuffer = await videoRes.arrayBuffer();

    // 3. رفع الفيديو إلى YouTube
    const youtubeVideoId = await uploadToYouTube(
      lesson.title || 'Lesson Recording',
      `Auto-uploaded from Ruh-Ul-Qudus Academy. Lesson ID: ${lessonId}`,
      videoBuffer
    );

    // 4. حفظ رابط YouTube في جدول الدروس
    const youtubeUrl = `https://youtu.be/${youtubeVideoId}`;
    await sql`
      UPDATE lessons SET recording_url = ${youtubeUrl} WHERE id = ${lessonId}
    `;

    return NextResponse.json({
      success: true,
      youtubeId: youtubeVideoId,
      url: youtubeUrl,
    });
  } catch (error) {
    // Provider responses can contain tokens/quota details: log, never return.
    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
});
