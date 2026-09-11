import { NextResponse } from "next/server";
import { EdgeTTS } from "voipi/edge-tts";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// Phase 2.3a: previously unauthenticated (unmetered TTS cost). The only
// caller is the admin lesson-scripts editor, so an admin session is required.
export const POST = withApi(async (req) => {
  await requireAdmin(req);

  const { text, voice } = await req.json();
  if (!text || !voice) return NextResponse.json({ error: "text and voice required" }, { status: 400 });

  const tts = new EdgeTTS({ voice });
  const audio = await tts.toAudio(text);
  const base64 = audio.data.toString("base64");

  return NextResponse.json({ audioBase64: base64 });
});
