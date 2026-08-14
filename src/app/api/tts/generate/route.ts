import { NextRequest, NextResponse } from "next/server";
import { EdgeTTS } from "voipi/edge-tts";

export async function POST(req: NextRequest) {
  try {
    const { text, voice } = await req.json();
    if (!text || !voice) return NextResponse.json({ error: "text and voice required" }, { status: 400 });

    const tts = new EdgeTTS({ voice });
    const audio = await tts.toAudio(text);
    const base64 = audio.data.toString("base64");

    return NextResponse.json({ audioBase64: base64 });
  } catch (err) {
    console.error("TTS error:", err);
    return NextResponse.json({ error: "TTS generation failed" }, { status: 500 });
  }
}