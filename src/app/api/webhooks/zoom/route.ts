import { NextResponse } from 'next/server';
import {
  INTERNAL_SECRET_HEADER,
  ZOOM_SIGNATURE_HEADER,
  ZOOM_TIMESTAMP_HEADER,
  verifyZoomSignature,
  zoomValidationToken,
} from '@/lib/security/internal-auth';

export const runtime = 'nodejs';

// Phase 3 batch 1 — Zoom webhook trust boundary.
// Previously any unauthenticated POST with `event: "recording.completed"`
// could trigger the YouTube upload pipeline. Now:
//   - fail closed when ZOOM_WEBHOOK_SECRET_TOKEN is not configured (500)
//   - every delivery must carry a valid Zoom signature over the raw body
//     with a fresh timestamp (401 otherwise)
//   - Zoom's `endpoint.url_validation` challenge is answered (required to
//     enable the webhook in the Zoom app settings)
//   - the internal call to the upload route carries `x-internal-secret`
// The recording.completed handling itself is unchanged.
export async function POST(request: Request) {
  const secretToken = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  if (!secretToken) {
    console.error('ZOOM_WEBHOOK_SECRET_TOKEN is not configured; refusing webhook.');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  try {
    const rawBody = await request.text();
    const timestamp = request.headers.get(ZOOM_TIMESTAMP_HEADER);
    const signature = request.headers.get(ZOOM_SIGNATURE_HEADER);
    if (!verifyZoomSignature(secretToken, timestamp, rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Zoom endpoint validation challenge
    if (body?.event === 'endpoint.url_validation') {
      const plainToken = body?.payload?.plainToken;
      if (typeof plainToken !== 'string' || !plainToken) {
        return NextResponse.json({ error: 'Missing plainToken' }, { status: 400 });
      }
      return NextResponse.json({
        plainToken,
        encryptedToken: zoomValidationToken(secretToken, plainToken),
      });
    }

    console.log('Zoom webhook received:', body?.event ?? 'unknown');

    if (body?.event === 'recording.completed') {
      const { payload } = body;

      const recordingFile = payload?.object?.recording_files?.find(
        (file: any) => file.file_type === 'MP4' && file.recording_type === 'shared_screen_with_speaker_view'
      ) || payload?.object?.recording_files?.[0];

      if (recordingFile) {
        const downloadUrl = recordingFile.download_url;
        const lessonId = payload?.object?.id;

        const internalSecret = process.env.INTERNAL_API_SECRET;
        if (!internalSecret) {
          console.error('INTERNAL_API_SECRET is not configured; cannot trigger YouTube upload.');
        } else if (typeof lessonId === 'string' && lessonId) {
          // استخدام new URL لاستخراج الأصل
          const origin = new URL(request.url).origin;
          const uploadApiUrl = `${origin}/api/lessons/${encodeURIComponent(lessonId)}/upload-youtube`;

          fetch(uploadApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              [INTERNAL_SECRET_HEADER]: internalSecret,
            },
            body: JSON.stringify({ recordingUrl: downloadUrl }),
          }).catch(err => console.error('Failed to trigger YouTube upload:', err));
        }
      }
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new NextResponse(null, { status: 500 });
  }
}
