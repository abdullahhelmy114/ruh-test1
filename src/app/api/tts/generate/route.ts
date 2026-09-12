import { NextResponse } from "next/server";
import { EdgeTTS } from "voipi/edge-tts";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { checkRateLimit, retryAfterSeconds } from "@/lib/security/rate-limit";
import { boundedString, isTtsVoiceShape } from "@/lib/security/input-policy";

// Phase 2.3a: previously unauthenticated (unmetered TTS cost). The only
// caller is the admin lesson-scripts editor, so an admin session is required.
//
// Phase 3 batch 5 — admin cost/resource hardening (not public containment):
//   - 30 generations / 10 min per admin uid
//   - text 1..3,000 chars; voice must look like an Edge voice id
//     (e.g. ar-SA-HamedNeural), never an arbitrary multi-kilobyte string
//   - BOUNDED REQUEST WAIT of TTS_WAIT_MS: the voipi EdgeTTS client exposes
//     no AbortSignal/cancel API, so the route stops waiting and returns 504,
//     but the underlying synthesis may continue in the background. This is
//     NOT guaranteed provider cancellation.
//   - generic errors
const ADMIN_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 };
const TEXT_MAX = 3000;
const TTS_WAIT_MS = 30_000;

class TtsTimeout extends Error {
  constructor() {
    super("tts timeout");
    this.name = "TtsTimeout";
  }
}

/** Resolves with the synthesis result or rejects with TtsTimeout after `ms`. Does not cancel the synthesis. */
function boundedWait<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TtsTimeout()), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

export const POST = withApi(async (req) => {
  const admin = await requireAdmin(req);

  const check = checkRateLimit(`tts:${admin.uid}`, ADMIN_LIMIT);
  if (!check.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds(check)) } }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { text: rawText, voice } = body as Record<string, unknown>;

  if (typeof rawText !== "string" || !rawText.trim() || !isTtsVoiceShape(voice)) {
    return NextResponse.json({ error: "text and voice required" }, { status: 400 });
  }
  const text = boundedString(rawText, { max: TEXT_MAX });
  if (!text) return NextResponse.json({ error: "Text too long" }, { status: 413 });

  try {
    const tts = new EdgeTTS({ voice });
    const audio = await boundedWait(tts.toAudio(text), TTS_WAIT_MS);
    const base64 = audio.data.toString("base64");
    return NextResponse.json({ audioBase64: base64 });
  } catch (error) {
    if (error instanceof TtsTimeout) {
      return NextResponse.json({ error: "Speech generation timed out" }, { status: 504 });
    }
    console.error("tts/generate failed:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Speech generation failed" }, { status: 502 });
  }
});
