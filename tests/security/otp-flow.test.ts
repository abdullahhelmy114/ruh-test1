/**
 * Phase 3 batch 4 — real OTP flow wiring. Static regression tests over the
 * route sources (comments stripped) proving the flow is coherent end to end:
 * signup issues, resend re-issues, the two verifiers consume, and the
 * profile route can no longer be told "email_verified: true" by a client.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dirname, "..", "..", "src");
const raw = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const code = (rel: string) => raw(rel).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const STUDENT = "app/api/signup/student/route.ts";
const TEACHER = "app/api/signup/teacher/route.ts";
const VERIFY = "app/api/verify-email-code/route.ts";
const VERIFY_TEACHER = "app/api/verify-teacher/route.ts";
const RESEND = "app/api/send-verification-code/route.ts";
const USER = "app/api/user/route.ts";

function assertIssuer(rel: string, profileInsert: string = rel) {
  const src = code(rel);
  assert.equal(src.includes("sendEmailVerificationCode"), false, `${rel} must not use the legacy generator`);
  assert.equal(src.includes("Math.random"), false);
  assert.ok(src.includes("generateOtp()"), "code comes from the OTP helper");
  assert.ok(src.includes("hashOtp(userRecord.uid, emailCode, otpSecret)"), "digest bound to the new uid");
  assert.ok(src.includes("verificationCodeEmail(emailCode)"), "existing e-mail template reused");
  assert.ok(src.includes('sendEmail('), "existing sender reused");
  assert.ok(src.includes("DELETE FROM verification_codes WHERE user_uid = ${userRecord.uid}"), "previous row invalidated");
  assert.ok(src.includes("VALUES (${userRecord.uid}, ${digest}, ${otpExpiry()})"), "stored value is the digest, not the code");
  assert.equal(/VALUES \(\$\{userRecord\.uid\}, \$\{emailCode\}/.test(src), false, "plaintext code must not be stored");
  assert.ok(src.indexOf("DELETE FROM verification_codes") < src.indexOf("INSERT INTO verification_codes"), "delete-then-insert");
  assert.ok(src.includes("checkRateLimit(`signup-account:${clientKey(req)}`"), "per-client signup limiter");
  assert.ok(src.includes("process.env.INTERNAL_API_SECRET"), "secret sourced from the server environment");
  assert.ok(src.indexOf("if (!otpSecret)") < src.indexOf("auth.createUser("), "fails closed before creating the Firebase user");
  assert.ok(src.includes("emailVerified: false"), "Firebase user still created unverified");
  assert.ok(code(profileInsert).includes("'pending'"), "profile still created pending");
}

describe("student signup issues a hashed OTP", () => {
  test("wiring", () => assertIssuer(STUDENT));
  test("business fields untouched", () => {
    const src = code(STUDENT);
    for (const needle of ["referral_code", "referred_by", "await newReferralCode()", "auth/email-already-exists", "{ success: true, uid: userRecord.uid }"]) {
      assert.ok(src.includes(needle), `student signup must still contain ${needle}`);
    }
  });
});

describe("teacher signup issues a hashed OTP", () => {
  test("wiring", () => assertIssuer(TEACHER, "lib/academy/repo/teacher-repo.ts"));
  test("no approval side effect: the account is an application under review, with private document references", () => {
    const src = code(TEACHER);
    assert.equal(src.includes("status = 'active'"), false);
    assert.equal(src.includes("'approved'"), false);
    assert.equal(/'teacher',\s*'active'/.test(code("lib/academy/repo/teacher-repo.ts")), false);
    assert.match(code("lib/academy/repo/teacher-repo.ts"), /'teacher', 'pending', \$\{input\.createdAt\}::timestamptz/, "the signup profile is a pending teacher account");
    assert.ok(src.includes("{ success: true, uid: userRecord.uid }"), "page contract kept");
    // Documents are referenced by server-proven upload ids, never by client-supplied links.
    assert.ok(src.includes('verifyUploadReference("teacher_cv", body.cv, otpSecret)'));
    assert.equal(/cv_url|intro_video_url|secure_url/.test(src), false, "no public document link is accepted or stored");
    // Everything is validated before the Firebase account exists; a failed database transaction deletes it again.
    for (const check of ["normalizeEmail(account.email)", "parseApplicationDetails(body.details)", 'verifyUploadReference("teacher_cv"', "academyFlags.coreSchemaReady"]) {
      assert.ok(src.indexOf(check) > 0 && src.indexOf(check) < src.indexOf("auth.createUser("), `${check} precedes account creation`);
    }
    assert.ok(src.indexOf("teacherService.planSignupApplication(") > src.indexOf("auth.createUser("));
    assert.ok(src.includes("await auth.deleteUser(userRecord.uid)"), "compensation when the application cannot be recorded");
    assert.equal(/const referralCode = (generateReferralCode\(\)|await newReferralCode\(\));/.test(src.slice(0, src.indexOf("export async function POST"))), false, "no referral code shared by every signup in a process");
    // One unused code per signup, allocated inside the request.
    const post = src.slice(src.indexOf("export async function POST"));
    assert.ok(post.includes("const referralCode = await newReferralCode();") && post.includes("details, referralCode, createdAt"));
  });
});

function assertVerifier(rel: string, codeField: string) {
  const src = code(rel);
  assert.ok(src.includes("withApi(async"));
  assert.ok(src.includes("checkRateLimit(`verify-code:${clientKey("), "per-client attempt limiter");
  assert.ok(src.includes("checkRateLimit(`verify-code:email:${email}`"), "per-e-mail attempt limiter");
  assert.ok(src.includes("checkRateLimit(`verify-code:uid:${"), "per-account attempt limiter");
  assert.ok(src.includes("normalizeEmail("), "e-mail normalised");
  assert.ok(src.includes("isOtpShape(code)"), "code shape checked before database work");
  assert.ok(src.indexOf("isOtpShape(code)") < src.indexOf("await sql`"), "shape check precedes the first query");
  assert.ok(src.indexOf("checkRateLimit(`verify-code:email:") < src.indexOf("await sql`"), "e-mail limiter precedes the first query");
  assert.ok(src.includes("verifyOtpHash("), "comparison through the OTP helper");
  assert.ok(src.indexOf("verifyOtpHash(") < src.indexOf("updateUser("), "comparison precedes side effects");
  assert.equal(/vc\.email_code = \$\{/.test(src), false, "no plaintext comparison in SQL");
  assert.equal(/email_code !== /.test(src), false, "no plaintext comparison in JS");
  // Ordering: idempotent side effects first, code deletion last, so a
  // transient Firebase/database failure leaves the code retryable.
  const iVerify = src.indexOf("verifyOtpHash(");
  const iFirebase = src.indexOf("updateUser(");
  const iProfile = src.indexOf("SET email_verified = TRUE");
  const iDelete = src.indexOf("DELETE FROM verification_codes");
  assert.ok(iVerify > 0 && iFirebase > iVerify, "Firebase update after verification");
  assert.ok(iProfile > iFirebase, "profile update after Firebase update");
  assert.ok(iDelete > iProfile, "code deleted only after both side effects");
  assert.equal((src.match(/DELETE FROM verification_codes/g) ?? []).length, 1, "exactly one delete, at the end");
  assert.ok(src.includes("DELETE FROM verification_codes WHERE user_uid = ${"), "all rows for the account removed");
  assert.equal(src.includes("RETURNING"), false, "no consume-before-side-effects pattern");
  assert.ok(src.includes("expires_at > NOW()"), "expiry enforced");
  assert.ok(src.includes("Invalid or expired verification code"), "generic failure");
  assert.equal(src.includes("Teacher not found"), false);
  assert.equal(src.includes("No valid code found"), false);
  assert.equal(src.includes("Invalid verification code\""), false);
  assert.equal(src.includes("error.message"), false);
  assert.equal(src.includes("status: 404"), false, "no not-found distinction");
  assert.ok(src.includes("status: 429"));
  assert.ok(src.includes("Retry-After"));
  assert.ok(src.includes("if (!secret) throw new HttpError(503"), "fails closed without the secret");
  assert.ok(src.indexOf("if (!secret) throw new HttpError(503") < src.indexOf("await sql`"), "secret check precedes database work");
  assert.ok(src.includes(`${codeField}: rawCode`), "code read from the page's existing field");
  for (const needle of ["body.uid", "body.userId", "body.firebase_uid", "x-user-id", "searchParams.get"]) {
    assert.equal(src.includes(needle), false, `${rel} must not trust a caller-supplied uid (${needle})`);
  }
  assert.ok(src.includes("updateUser(") && src.includes("{ emailVerified: true }"), "Firebase side effect preserved");
  assert.ok(src.includes("SET email_verified = TRUE"), "profile side effect preserved");
  assert.equal(/console\.(log|error|warn)\([^)]*(code|digest|secret|storedDigest|email_code)/i.test(src), false, "no OTP material logged");
}

describe("verify-email-code", () => {
  test("hardened verifier wiring", () => assertVerifier(VERIFY, "code"));
  test("student activation preserved; teachers not activated", () => {
    const src = code(VERIFY);
    assert.ok(src.includes("if (role === 'student')"));
    assert.ok(src.includes("SET email_verified = TRUE, status = 'active' WHERE firebase_uid = ${firebase_uid}"));
    assert.equal((src.match(/status = 'active'/g) ?? []).length, 1, "only the student branch activates");
    // Page contract: the role, and the account's home by role and status (a teacher reaches teaching only once approved).
    assert.ok(src.includes("return NextResponse.json({ success: true, role, home })"), "page contract kept");
    assert.ok(src.includes("const home = accountHome(role, role === 'student' ? ACTIVE_ACCOUNT_STATUS : status);"));
  });
});

describe("verify-teacher", () => {
  test("hardened verifier wiring", () => assertVerifier(VERIFY_TEACHER, "emailCode"));
  test("no teacher activation added; role scoped to teachers", () => {
    const src = code(VERIFY_TEACHER);
    assert.equal(src.includes("status = 'active'"), false);
    assert.equal(src.includes("'approved'"), false);
    assert.ok(src.includes("p.role = 'teacher'"));
    assert.ok(src.includes("return NextResponse.json({ success: true })"), "page contract kept");
    assert.ok(src.includes('{ message: GENERIC_FAILURE }'), "page reads data.message");
  });
  test("limiter keys are shared with verify-email-code", () => {
    const a = code(VERIFY);
    const b = code(VERIFY_TEACHER);
    for (const key of ["`verify-code:${clientKey(", "`verify-code:email:${email}`", "`verify-code:uid:${"]) {
      assert.ok(a.includes(key) && b.includes(key), `both verifiers use ${key}`);
    }
  });
});

describe("resend writes the table the verifiers read", () => {
  const src = code(RESEND);
  test("real flow", () => {
    assert.ok(src.includes("INSERT INTO verification_codes (user_uid, email_code, expires_at)"));
    assert.ok(src.includes("DELETE FROM verification_codes WHERE user_uid = ${uid}"), "old code invalidated");
    assert.ok(src.indexOf("DELETE FROM verification_codes") < src.indexOf("INSERT INTO verification_codes"));
    assert.equal(src.includes("email_verifications"), false, "legacy table no longer written");
    assert.ok(src.includes("generateOtp()") && src.includes("hashOtp(uid, code, secret)"));
    assert.ok(src.includes("VALUES (${uid}, ${digest}, ${otpExpiry()})"), "digest stored, not the code");
    assert.equal(src.includes("Math.random"), false);
    assert.equal(src.includes("randomInt("), false, "generation is centralised in the helper");
    assert.ok(src.includes("verificationCodeEmail(code)"));
  });
  test("uniform response for unknown / already verified / issued", () => {
    assert.ok(src.includes("if (!profile || profile.email_verified === true) return ok()"));
    assert.equal((src.match(/return ok\(\)/g) ?? []).length, 2, "same success helper on both paths");
    assert.equal(src.includes("not found"), false);
    assert.equal(src.includes("already verified"), false);
    assert.equal(src.includes("error.message"), false);
  });
  test("Batch 3 controls retained", () => {
    assert.ok(src.includes("checkRateLimit(`verify-send:${clientKey(request)}`"));
    assert.ok(src.includes("checkRateLimit(`verify-send:cooldown:${email}`"));
    assert.ok(src.includes("checkRateLimit(`verify-send:email:${email}`"));
    assert.ok(src.includes("RESEND_COOLDOWN") && src.includes("normalizeEmail(") && src.includes("status: 429"));
    assert.ok(src.indexOf("checkRateLimit(`verify-send:email:") < src.indexOf("await sql`"), "limits precede database work");
  });
});

describe("/api/user cannot be told email_verified by the client", () => {
  const src = code(USER);
  test("the upsert never touches email_verified; no new network coupling", () => {
    assert.equal(/body\.email_verified/.test(src), false);
    assert.equal(/body\.emailVerified/.test(src), false);
    assert.equal(/body\[/.test(src), false, "no dynamic body access");
    assert.equal(/\.\.\.body/.test(src), false, "no body spreading");
    const post = src.slice(src.indexOf("export const POST"));
    assert.equal(post.includes("email_verified"), false, "POST neither inserts nor updates email_verified");
    assert.equal(post.includes("emailVerified"), false);
    assert.equal(src.includes("getAdminAuth"), false, "no Firebase Admin lookup added to profile updates");
  });
  test("the upsert is retired: no client email, referrer or role reaches the profile (see tests/security/referrals.test.ts)", () => {
    // It could only update an existing row (the session requires a profile), setting any email and a forged referrer.
    for (const needle of ["body.email", "body.referred_by", "INSERT INTO profiles", "referred_by"]) {
      assert.equal(src.includes(needle), false, `must not contain ${needle}`);
    }
    assert.ok(src.includes("{ error: 'Profiles are created at signup and changed with PATCH.' }, { status: 410 }"));
    assert.equal(/role = \$\{/.test(src), false, "role still not client-controlled");
  });
});

describe("verification pages", () => {
  const STUDENT_PAGE = "app/verify-email/page.tsx";
  const TEACHER_PAGE = "app/verify-teacher/page.tsx";
  test("both pages keep the code as a string end to end (leading zeros such as 000123 survive)", () => {
    for (const rel of [STUDENT_PAGE, TEACHER_PAGE]) {
      const src = code(rel);
      assert.ok(src.includes('useState<string[]>(Array(6).fill(""))'), `${rel} stores digits as strings`);
      assert.ok(src.includes('digits.join("")'), `${rel} joins digits into a string`);
      assert.ok(src.includes('inputMode="numeric"') && src.includes('type="text"'), `${rel} uses a text input`);
      for (const bad of ["parseInt(", "Number(", "type=\"number\"", "valueAsNumber", "+fullCode", "+emailCode"]) {
        assert.equal(src.includes(bad), false, `${rel} must not coerce the code numerically (${bad})`);
      }
    }
    assert.ok(code(STUDENT_PAGE).includes("JSON.stringify({ email, code: fullCode })"));
    assert.ok(code(TEACHER_PAGE).includes("JSON.stringify({ email, emailCode })"));
  });
  test("both pages expose the resend control (recovery after expiry or the HMAC cutover)", () => {
    for (const rel of [STUDENT_PAGE, TEACHER_PAGE]) {
      const src = code(rel);
      assert.ok(src.includes('import { ResendVerificationButton } from "@/components/ResendVerificationButton"'), `${rel} imports resend`);
      assert.ok(src.includes("<ResendVerificationButton />"), `${rel} renders resend`);
    }
    const button = code("components/ResendVerificationButton.tsx");
    assert.ok(button.includes('fetch("/api/send-verification-code"'), "resend targets the real route");
  });
});

describe("batch boundary", () => {
  test("src/lib/email.ts is not part of the batch and its legacy generator is no longer imported by the real flow", () => {
    const email = raw("lib/email.ts");
    assert.ok(email.includes("export async function sendEmailVerificationCode("), "user-owned function left physically in place");
    assert.ok(email.includes("export function verificationCodeEmail("), "template reused, not moved");
    for (const rel of [STUDENT, TEACHER, VERIFY, VERIFY_TEACHER, RESEND, USER]) {
      assert.equal(code(rel).includes("sendEmailVerificationCode"), false, `${rel} must not import the legacy generator`);
    }
  });
  test("no route in the batch reads a caller uid from headers, query or body", () => {
    for (const rel of [STUDENT, TEACHER, VERIFY, VERIFY_TEACHER, RESEND]) {
      const src = code(rel);
      for (const needle of ["x-user-id", "x-user-role", "body.uid", "body.userId", "searchParams.get('uid')"]) {
        assert.equal(src.includes(needle), false, `${rel} must not contain ${needle}`);
      }
      assert.equal(/console\.(log|error|warn)\([^)]*(SECRET|otpSecret|secret\b|digest)/.test(src), false, `${rel} must not log OTP material`);
    }
  });
});
