import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Zoom webhook received:', JSON.stringify(body));

    if (body.event === 'recording.completed') {
      const { payload } = body;
      
      const recordingFile = payload.object.recording_files?.find(
        (file: any) => file.file_type === 'MP4' && file.recording_type === 'shared_screen_with_speaker_view'
      ) || payload.object.recording_files?.[0];

      if (recordingFile) {
        const downloadUrl = recordingFile.download_url;
        const lessonId = payload.object.id;

        // استخدام new URL لاستخراج الأصل
        const origin = new URL(request.url).origin;
        const uploadApiUrl = `${origin}/api/lessons/${lessonId}/upload-youtube`;
        
        fetch(uploadApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recordingUrl: downloadUrl }),
        }).catch(err => console.error('Failed to trigger YouTube upload:', err));
      }
    }

    return new NextResponse(null, { status: 200 });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return new NextResponse(null, { status: 500 });
  }
}