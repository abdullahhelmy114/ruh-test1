/**
 * API routes reachable without an account, on purpose, with the reason and
 * the control that replaces sign-in (which must appear in the route file).
 * Shared by tests/security/api-route-inventory.test.ts (static) and
 * tests/e2e/http-smoke.e2e.ts (against a running build). Paths are relative
 * to src/app/api.
 */
export const PUBLIC_API_ROUTES: Readonly<Record<string, { readonly reason: string; readonly control?: RegExp }>> = {
  "academy-info/route.ts": { reason: "curated public site information for the assistant" },
  "ai/chat/route.ts": { reason: "public site assistant", control: /checkRateLimit\(/ },
  "bundles/route.ts": { reason: "public catalog" },
  "certification/route.ts": { reason: "public certification information" },
  "cloudinary/sign-upload/route.ts": { reason: "teacher signup uploads before an account exists", control: /checkRateLimit\(/ },
  "contact/route.ts": { reason: "contact form", control: /checkRateLimit\(/ },
  "course/[id]/route.ts": { reason: "public course page" },
  "course/route.ts": { reason: "public catalog" },
  "courses/route.ts": { reason: "public catalog" },
  "instructors/route.ts": { reason: "public teacher list" },
  "irab/route.ts": { reason: "public Quran grammar tool" },
  "lessons/[id]/upload-youtube/route.ts": { reason: "internal job endpoint", control: /checkInternalSecret\(/ },
  "public/academy/catalog/route.ts": { reason: "public academy catalog", control: /checkRateLimit\(/ },
  "public/academy/courses/[slug]/route.ts": { reason: "public academy course page", control: /checkRateLimit\(/ },
  "public/academy/programs/[slug]/route.ts": { reason: "public academy program page", control: /checkRateLimit\(/ },
  "public/certificates/[code]/route.ts": { reason: "public certificate verification", control: /checkRateLimit\(/ },
  "quran-irab/route.ts": { reason: "public Quran grammar tool" },
  "quran-tafsir/route.ts": { reason: "public Quran commentary tool" },
  "send-verification-code/route.ts": { reason: "email verification before sign-in", control: /checkRateLimit\(/ },
  "signup/route.ts": { reason: "account creation", control: /checkRateLimit\(/ },
  "signup/student/route.ts": { reason: "account creation", control: /verifyRecaptcha\(|checkRateLimit\(/ },
  "signup/teacher/route.ts": { reason: "account creation", control: /verifyRecaptcha\(|checkRateLimit\(/ },
  "student/course/[courseId]/prompts/route.ts": { reason: "constant placeholder with no data" },
  "student/course/[courseId]/stats/route.ts": { reason: "constant placeholder with no data" },
  "teacher/public/[uid]/route.ts": { reason: "public teacher profile" },
  "teacher/rating/route.ts": { reason: "public teacher rating summary" },
  "uploads/[...path]/route.ts": { reason: "legacy public file serving", control: /resolveWithinRoot\(/ },
  "verify-email-code/route.ts": { reason: "email verification before sign-in", control: /checkRateLimit\(/ },
  "verify-teacher/route.ts": { reason: "email verification before sign-in", control: /checkRateLimit\(|verifyOtp|hashOtp/ },
  "waitlist/route.ts": { reason: "waitlist form", control: /checkRateLimit\(/ },
  "webhooks/whop/route.ts": { reason: "payment provider webhook", control: /timingSafeEqual|verifyWhopSignature|verifyWebhook/ },
  "webhooks/zoom/route.ts": { reason: "meeting provider webhook", control: /timingSafeEqual|verifyZoom|verifyWebhook/ },
  "words/[id]/route.ts": { reason: "public dictionary" },
  "words/route.ts": { reason: "public dictionary" },
};

/**
 * Handlers that answer anonymous callers on purpose inside route files whose
 * other handlers (or other query modes) require sign-in.
 */
export const PUBLIC_HANDLERS: Readonly<Record<string, { readonly methods: readonly string[]; readonly reason: string }>> = {
  "auth/session/route.ts": { methods: ["POST"], reason: "the sign-in exchange: verifies a Firebase ID token, then sets the session cookie" },
  "categories/route.ts": { methods: ["GET"], reason: "public category list; changes require an administrator" },
  "library/access/route.ts": { methods: ["GET"], reason: "tells signed-out readers to sign in (hasAccess false)" },
  "library/books/route.ts": { methods: ["GET"], reason: "public catalog list; a single book's content requires library access" },
  "reviews/route.ts": { methods: ["GET"], reason: "public course reviews; posting requires sign-in" },
};
