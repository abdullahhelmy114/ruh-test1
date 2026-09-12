// app/api/evaluate-writing/route.ts
// تصحيح الكتابة وتقييمها باستخدام Gemini (عبر العميل المشترك)

import { NextResponse } from "next/server";
import { evaluateWriting } from "@/lib/ai/evaluate-writing";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { checkRateLimit, retryAfterSeconds } from "@/lib/security/rate-limit";
import { boundedString } from "@/lib/security/input-policy";

// Phase 3 batch 5 — authenticated cost control.
// Previously: a bespoke Bearer-only check against the legacy Firebase helper,
// unbounded prompt/answer text fed to the model (and to a quadratic
// Levenshtein fallback), no quota, and `error.message` (including provider
// bodies) returned to the caller. Now:
//   - central requireAuth; the verified uid keys the limiter
//   - 10 evaluations / 10 min per user
//   - prompt <= 2,000 and answer <= 5,000 chars, rejected (413) BEFORE the
//     provider call and before the fallback can run
//   - provider retries/timeout come from the hardened shared client
//   - generic errors only
// Grading semantics (prompt, model, parsing, fallback) are unchanged.
const USER_LIMIT = { limit: 10, windowMs: 10 * 60 * 1000 };
const PROMPT_MAX = 2000;
const ANSWER_MAX = 5000;

export const POST = withApi(async (request) => {
  const user = await requireAuth(request);

  const check = checkRateLimit(`evaluate-writing:${user.uid}`, USER_LIMIT);
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
  const { prompt: rawPrompt, userAnswer: rawAnswer } = body as Record<string, unknown>;

  if (typeof rawPrompt !== "string" || !rawPrompt.trim() || typeof rawAnswer !== "string" || !rawAnswer.trim()) {
    return NextResponse.json(
      { error: "Both prompt and userAnswer are required" },
      { status: 400 }
    );
  }
  const prompt = boundedString(rawPrompt, { max: PROMPT_MAX });
  const userAnswer = boundedString(rawAnswer, { max: ANSWER_MAX });
  if (!prompt || !userAnswer) {
    return NextResponse.json({ error: "Input too long" }, { status: 413 });
  }

  try {
    const result = await evaluateWriting(prompt, userAnswer);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("evaluate-writing failed:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Failed to evaluate writing" }, { status: 502 });
  }
});
