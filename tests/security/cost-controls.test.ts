/**
 * Phase 3 batch 5 — static wiring of the authenticated abuse/cost controls.
 * Comments are stripped before every assertion so a comment cannot satisfy
 * (or trip) a needle.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dirname, "..", "..", "src");
const code = (rel: string) =>
  readFileSync(join(SRC, rel), "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const R = {
  writing: "app/api/evaluate-writing/route.ts",
  speaking: "app/api/evaluate-speaking/route.ts",
  tutor: "app/api/tutor/route.ts",
  tts: "app/api/tts/generate/route.ts",
  questions: "app/api/admin/generate-questions/route.ts",
  games: "app/api/admin/generate-games/route.ts",
  curriculum: "app/api/admin/curriculum/start/route.ts",
  messages: "app/api/messages/route.ts",
  chat: "app/api/chat/send/route.ts",
  coupon: "app/api/coupons/validate/route.ts",
};

function assertCommon(rel: string, guard: "requireAuth" | "requireAdmin", limiterPrefix: string) {
  const src = code(rel);
  assert.ok(src.includes("withApi(async"), `${rel} uses withApi`);
  assert.ok(src.includes(`await ${guard}(`), `${rel} uses central ${guard}`);
  assert.ok(src.includes(`checkRateLimit(\`${limiterPrefix}:\${`), `${rel} has a ${limiterPrefix} limiter`);
  assert.ok(src.includes(".uid}`"), `${rel} limiter keyed by the verified uid`);
  assert.ok(src.includes("status: 429") && src.includes("Retry-After"), `${rel} returns 429 with Retry-After`);
  // The request handler must never surface error.message. (curriculum/start's
  // detached background task still records a failure reason in the admin-only
  // task row; that is not a response and is asserted separately below.)
  const handler = src.slice(src.indexOf("export const POST"));
  assert.equal(handler.includes("error.message"), false, `${rel} must not return error.message`);
  for (const needle of ["body.uid", "body.userId", "x-user-id", "x-user-role", "searchParams.get('uid')", 'searchParams.get("uid")']) {
    assert.equal(src.includes(needle), false, `${rel} must not trust ${needle}`);
  }
  assert.equal(src.includes("@/lib/firebase-admin"), false, `${rel} must not use the legacy Firebase helper`);
}

describe("evaluate-writing", () => {
  test("central auth, uid limiter, caps before provider, generic errors", () => {
    assertCommon(R.writing, "requireAuth", "evaluate-writing");
    const src = code(R.writing);
    assert.ok(src.includes("PROMPT_MAX = 2000") && src.includes("ANSWER_MAX = 5000"));
    assert.ok(src.includes("boundedString(rawPrompt, { max: PROMPT_MAX })"));
    assert.ok(src.includes("boundedString(rawAnswer, { max: ANSWER_MAX })"));
    assert.ok(src.includes("status: 413"));
    assert.ok(src.indexOf("checkRateLimit(") < src.indexOf("await evaluateWriting("), "limiter before provider work");
    assert.ok(src.indexOf("status: 413") < src.indexOf("await evaluateWriting("), "size cap before provider work");
    assert.ok(src.includes('{ error: "Failed to evaluate writing" }'));
    assert.equal(/console\.error\([^)]*(prompt|userAnswer)\b/.test(src), false, "user text is not logged");
  });
});

describe("evaluate-speaking", () => {
  test("central auth, uid limiter, caps before provider, generic errors", () => {
    assertCommon(R.speaking, "requireAuth", "evaluate-speaking");
    const src = code(R.speaking);
    assert.ok(src.includes("TEXT_MAX = 2000"));
    assert.ok(src.includes("boundedString(rawExpected, { max: TEXT_MAX })") && src.includes("boundedString(rawActual, { max: TEXT_MAX })"));
    assert.ok(src.indexOf("status: 413") < src.indexOf("await evaluateSpeaking("));
    assert.ok(src.includes('{ error: "Failed to evaluate speaking" }'));
  });
});

describe("tutor", () => {
  const src = code(R.tutor);
  test("authenticated per-uid limiter added; anonymous sales limiter retained separately", () => {
    assert.ok(src.includes("checkRateLimit(`tutor-sales:${clientKey(req)}`"), "anonymous limiter still present");
    assert.ok(src.includes("checkRateLimit(`tutor-auth:${user.uid}`, AUTH_USER_LIMIT)"), "authenticated limiter present");
    assert.ok(src.includes("AUTH_USER_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 }"));
    const anon = src.indexOf("if (!user) {");
    const auth = src.indexOf("} else {", anon);
    assert.ok(anon > 0 && auth > anon && src.indexOf("tutor-auth:", auth) > auth, "auth limiter lives in the else branch of the anonymous check");
    // The first GEMINI_URL fetch belongs to the assessment helper defined above the handler; the handler's own call is the last one.
    assert.ok(src.indexOf("tutor-auth:") < src.lastIndexOf("await fetch(GEMINI_URL"), "limiter before Gemini work");
    assert.ok(src.includes("context === 'sales' ? null : await requireAuth(req)"), "auth behaviour unchanged");
    assert.ok(src.includes("MESSAGE_MAX") && src.includes("boundedHistory(history)"), "batch 3 caps retained");
    assert.equal((src.match(/AbortSignal\.timeout\(PROVIDER_TIMEOUT_MS\)/g) ?? []).length, 2, "batch 3 timeouts retained");
    assert.equal(src.includes("?key="), false);
  });
});

describe("tts/generate", () => {
  test("admin, admin-uid limiter, text cap, voice validation, bounded wait (not cancellation)", () => {
    assertCommon(R.tts, "requireAdmin", "tts");
    const src = code(R.tts);
    assert.ok(src.includes("ADMIN_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 }"));
    assert.ok(src.includes("TEXT_MAX = 3000") && src.includes("boundedString(rawText, { max: TEXT_MAX })"));
    assert.ok(src.includes("isTtsVoiceShape(voice)"));
    assert.ok(src.includes("TTS_WAIT_MS = 30_000") && src.includes("boundedWait(tts.toAudio(text), TTS_WAIT_MS)"));
    assert.ok(src.includes("status: 504"), "timed-out wait is reported, not treated as success");
    assert.ok(src.includes("status: 413"));
    assert.ok(src.indexOf("status: 413") < src.indexOf("new EdgeTTS("), "caps before synthesis");
  });
});

function assertGenerator(rel: string, prefix: string, typesConst: string, arrayField: string) {
  assertCommon(rel, "requireAdmin", prefix);
  const src = code(rel);
  assert.ok(src.includes("ADMIN_LIMIT = { limit: 10, windowMs: 10 * 60 * 1000 }"));
  assert.ok(src.includes("SOURCE_MAX = 80_000") && src.includes("boundedString(rawSource, { max: SOURCE_MAX })"));
  assert.ok(src.includes("TYPES_MAX = 8") && src.includes(`isAllowedStringArray(${arrayField}, ${typesConst}, TYPES_MAX)`));
  assert.ok(src.includes("COUNT_MAX = 20") && src.includes("boundedPositiveInt(rawCount, 1, COUNT_MAX)"));
  const gen = src.indexOf(prefix === "generate-questions" ? "await generateQuestionsFromText(" : "await generateGamesFromText(");
  assert.ok(gen > 0);
  for (const before of ["checkRateLimit(", "SOURCE_MAX })", "isAllowedStringArray(", "boundedPositiveInt("]) {
    assert.ok(src.indexOf(before) < gen, `${rel}: ${before} precedes the provider fan-out`);
  }
  assert.ok(src.includes("status: 413"));
  assert.ok(src.includes("save === true && courseId"), "optional save path retained");
}

describe("admin generators", () => {
  test("generate-questions bounds", () => {
    assertGenerator(R.questions, "generate-questions", "QUESTION_TYPES", "questionTypes");
    const src = code(R.questions);
    for (const t of ["choice", "true_false", "fill_blank", "word_order", "matching", "listening", "writing", "speaking"]) {
      assert.ok(src.includes(`"${t}"`), `question type ${t} listed`);
    }
  });
  test("generate-games bounds", () => {
    assertGenerator(R.games, "generate-games", "GAME_TYPES", "gameTypes");
    const src = code(R.games);
    for (const t of ["word_order", "speed_choice", "matching", "letter_connect", "time_race", "coloring"]) {
      assert.ok(src.includes(`"${t}"`), `game type ${t} listed`);
    }
  });
});

describe("curriculum/start", () => {
  test("admin, per-admin limiter, lesson/count/source bounds before any task row", () => {
    assertCommon(R.curriculum, "requireAdmin", "curriculum-start");
    const src = code(R.curriculum);
    assert.ok(src.includes("ADMIN_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 }"));
    assert.ok(src.includes("LESSONS_MAX = 50") && src.includes("rawLessons.length > LESSONS_MAX"));
    assert.ok(src.includes("TITLE_MAX = 200") && src.includes("DESCRIPTION_MAX = 1000"));
    assert.ok(src.includes("QUIZ_COUNT_MAX = 30") && src.includes("boundedPositiveInt(s.quizCount, 1, QUIZ_COUNT_MAX)"));
    assert.ok(src.includes("SOURCE_MAX = 200_000") && src.includes("optionalBoundedString(s.sourceText, SOURCE_MAX)"));
    assert.ok(src.includes('typeof generateAudio !== "boolean"') && src.includes('typeof generateVideo !== "boolean"'));
    const insert = src.indexOf("INSERT INTO curriculum_tasks");
    for (const before of ["checkRateLimit(", "LESSONS_MAX", "TITLE_MAX })", "QUIZ_COUNT_MAX)", "SOURCE_MAX)"]) {
      assert.ok(src.indexOf(before) < insert, `${before} precedes task creation`);
    }
    assert.equal(/rawLessons\.slice\(/.test(src), false, "oversized lesson lists are rejected, not sliced");
    assert.ok(src.includes("settings_json = ${JSON.stringify(settings)}"), "only validated settings persisted");
    assert.equal(src.includes("JSON.stringify(settings || {})"), false, "raw client settings no longer persisted");
    assert.ok(src.includes("timeoutMs: LESSON_HTML_TIMEOUT_MS") && src.includes("LESSON_HTML_TIMEOUT_MS = 180_000"));
    assert.ok(src.includes("processCurriculumTask(taskId)"), "detached execution unchanged");
    // Background task: the stored failure reason now comes from the sanitised
    // shared client (status only), and the POST response itself is generic.
    const handler = src.slice(src.indexOf("export const POST"));
    assert.ok(handler.includes('{ error: "Failed to start task" }'));
    assert.equal(handler.includes("error.message"), false);
  });
});

describe("messages", () => {
  test("verified sender, uid limiter, message cap, receiver shape, no sender from body", () => {
    assertCommon(R.messages, "requireAuth", "messages");
    const src = code(R.messages);
    assert.ok(src.includes("SENDER_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 }"));
    assert.ok(src.includes("MESSAGE_MAX = 2000") && src.includes("boundedString(rawMessage, { max: MESSAGE_MAX })"));
    assert.ok(src.includes("isFirebaseUidShape(receiverUid)"));
    assert.ok(src.includes("VALUES (${user.uid}, ${receiverUid}, ${message})"), "sender is the verified caller");
    assert.equal(src.includes("senderUid"), false, "no client-supplied sender");
    assert.equal((src.match(/status: 400/g) ?? []).length, 2, "one generic 400 for body and one for fields");
    assert.equal(src.includes("not found"), false, "no receiver-existence oracle added");
    assert.ok(src.indexOf("checkRateLimit(") < src.indexOf("INSERT INTO messages"), "limiter before writes");
  });
});

describe("chat/send", () => {
  test("verified sender, uid limiter, message cap, room shape; authorization explicitly open", () => {
    assertCommon(R.chat, "requireAuth", "chat-send");
    const src = code(R.chat);
    assert.ok(src.includes("SENDER_LIMIT = { limit: 60, windowMs: 10 * 60 * 1000 }"));
    assert.ok(src.includes("MESSAGE_MAX = 1000") && src.includes("boundedString(rawMessage, { max: MESSAGE_MAX })"));
    assert.ok(src.includes("isPusherChannelShape(room)"));
    assert.ok(src.includes("pusher.trigger(room, 'message', { user: displayName"), "display identity from the verified profile");
    assert.equal(src.includes("body.user"), false);
    assert.ok(src.indexOf("checkRateLimit(") < src.indexOf("pusher.trigger("), "limiter before publish");
    assert.equal(/membership|isMember|allowedRooms/.test(src), false, "no room-membership policy invented");
    const raw = readFileSync(join(SRC, R.chat), "utf8");
    assert.ok(raw.includes("PRODUCT-POLICY DEPENDENCY"), "open authorization finding is documented in the route");
  });
});

describe("coupons/validate", () => {
  test("verified auth, uid limiter, normalisation, shape, unchanged success response", () => {
    assertCommon(R.coupon, "requireAuth", "coupon-validate");
    const src = code(R.coupon);
    assert.ok(src.includes("USER_LIMIT = { limit: 10, windowMs: 10 * 60 * 1000 }"));
    assert.ok(src.includes("normalizeCouponCode(") && src.includes("isCouponCodeShape(code)"));
    assert.ok(src.includes("if (!isCouponCodeShape(code)) return NextResponse.json(INVALID)"), "malformed code answered like a miss");
    assert.ok(src.includes("WHERE code = ${code}"));
    assert.equal(src.includes("code.toUpperCase()"), false, "normalisation centralised in the helper");
    assert.ok(src.includes("discount_percent: coupon.discount_percent") && src.includes("coupon_id: coupon.id"));
    for (const needle of ["current_uses = ", "UPDATE coupons", "INSERT INTO", "redeem"]) {
      assert.equal(src.includes(needle), false, `redemption semantics untouched (${needle})`);
    }
  });
});

describe("batch boundary", () => {
  test("every batch-5 route relies on the shared limiter and input policy, never a second limiter", () => {
    for (const rel of Object.values(R)) {
      const src = code(rel);
      assert.ok(src.includes('from "@/lib/security/rate-limit"') || src.includes("from '@/lib/security/rate-limit'"), `${rel} imports the shared limiter`);
      assert.equal(/new Map<|createRateLimiter\(/.test(src), false, `${rel} must not build its own limiter`);
      // curriculum/start keeps a pre-existing Math.random() in a non-security
      // quiz-block id inside the background task; no batch-5 control uses it.
      if (rel !== R.curriculum) assert.equal(src.includes("Math.random"), false, `${rel} must not use Math.random`);
      assert.equal(src.includes("@ts-ignore"), false);
    }
  });
  test("deferred files were not touched by this batch's helpers", () => {
    for (const rel of [
      "app/api/admin/curriculum/outline/route.ts",
      "app/api/admin/curriculum/extract-text/route.ts",
      "app/api/admin/knowledge/upload-gemini/route.ts",
      "app/api/notifications/register/route.ts",
      "app/api/admin/send-notification/route.ts",
    ]) {
      assert.equal(code(rel).includes("input-policy"), false, `${rel} is out of scope for batch 5`);
    }
  });
});
