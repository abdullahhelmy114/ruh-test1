// app/api/evaluate-speaking/route.ts
// تقييم نطق الطالب باستخدام Gemini (عبر العميل المشترك)

import { NextResponse } from "next/server";
import { evaluateSpeaking } from "@/lib/ai/evaluate-speaking";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { checkRateLimit, retryAfterSeconds } from "@/lib/security/rate-limit";
import { boundedString } from "@/lib/security/input-policy";

// Phase 3 batch 5 — authenticated cost control. Same treatment as
// evaluate-writing: central requireAuth, per-uid limiter (20 / 10 min:
// re-recording is common), expected text and transcript each <= 2,000 chars
// rejected before the provider call and the quadratic fallback, hardened
// shared-client retry/timeout, generic errors. The input is the browser
// speech-recognition transcript (no audio is uploaded); scoring is unchanged.
const USER_LIMIT = { limit: 20, windowMs: 10 * 60 * 1000 };
const TEXT_MAX = 2000;

export const POST = withApi(async (request) => {
  const user = await requireAuth(request);

  const check = checkRateLimit(`evaluate-speaking:${user.uid}`, USER_LIMIT);
  if (!check.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds(check)) } }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { expectedText: rawExpected, actualText: rawActual } = body as Record<string, unknown>;

  if (typeof rawExpected !== "string" || !rawExpected.trim() || typeof rawActual !== "string" || !rawActual.trim()) {
    return NextResponse.json(
      { error: "Both expectedText and actualText are required" },
      { status: 400 }
    );
  }
  const expectedText = boundedString(rawExpected, { max: TEXT_MAX });
  const actualText = boundedString(rawActual, { max: TEXT_MAX });
  if (!expectedText || !actualText) {
    return NextResponse.json({ error: "Input too long" }, { status: 413 });
  }

  try {
    const result = await evaluateSpeaking(expectedText, actualText);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("evaluate-speaking failed:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Failed to evaluate speaking" }, { status: 502 });
  }
});
