// لاحظ: لا نستخدم Edge Runtime هنا، لأننا نحتاج Node.js
export const runtime = 'nodejs'; // هذا يجعلها Function عادية على Netlify (AWS Lambda)

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

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

// ── API Route Handler ─────────────────────────────
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: lessonId } = await context.params;

  try {
    // 1. جلب رابط تسجيل Zoom من قاعدة البيانات (يُفترض أن Zoom Webhook أضافه)
    const [lesson] = await sql`
      SELECT recording_url, title FROM lessons WHERE id = ${lessonId}
    `;

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const recordingUrl = lesson.recording_url; // رابط تنزيل فيديو Zoom (مؤقت)
    if (!recordingUrl) {
      return NextResponse.json({ error: 'No recording URL available' }, { status: 400 });
    }

    // 2. تنزيل الفيديو من Zoom
    const videoRes = await fetch(recordingUrl);
    if (!videoRes.ok) {
      throw new Error(`Failed to download video from Zoom: ${videoRes.status}`);
    }
    const videoBuffer = await videoRes.arrayBuffer();

    // 3. رفع الفيديو إلى YouTube
    const youtubeVideoId = await uploadToYouTube(
      lesson.title || 'Lesson Recording',
      `Auto-uploaded from Ruhulqudus Academy. Lesson ID: ${lessonId}`,
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
  } catch (error: any) {
    console.error('Upload failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}