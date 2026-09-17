import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { sql } from "@/lib/db/client";
import { sendEmail, verificationCodeEmail } from "@/lib/email";
import { generateReferralCode } from "@/lib/referral";
import { checkRateLimit, clientKey, normalizeEmail, retryAfterSeconds } from "@/lib/security/rate-limit";
import { generateOtp, hashOtp, otpExpiry } from "@/lib/security/otp";
import { verifyUploadReference } from "@/lib/security/cloudinary-sign";
import { DomainError } from "@/lib/academy/domain/errors";
import { expectRows } from "@/lib/academy/repo/audit-repo";
import { insertTeacherProfileQuery } from "@/lib/academy/repo/teacher-repo";
import { runGuarded } from "@/lib/academy/services/support";
import { parseApplicationDetails } from "@/lib/academy/teachers/applications";
import { academyExecutor, academyFlags, teacherService } from "@/lib/academy/server";

// Teacher signup = a new account plus its teacher APPLICATION, never a teacher.
//
// Order of work, so a refusal never leaves an account behind:
//   1. per-client limiter; fail closed (503) without the OTP secret or before
//      the academy schema exists (applications could not be recorded);
//   2. validate everything BEFORE creating the Firebase account: email,
//      password, application details, and the CV / introduction video
//      references, which must carry this server's upload proof (so they can
//      only be private uploads it authorised);
//   3. create the Firebase account (emailVerified: false);
//   4. ONE database transaction: the profile (role 'teacher', status
//      'pending'), the application ('submitted'), its history event, its
//      audit event and the account-status guard. If it fails, the Firebase
//      account is deleted again (compensation) and the caller is told why
//      in a stable code;
//   5. issue the email verification code (Phase 3 batch 4: CSPRNG code from
//      the OTP helper, HMAC digest stored in verification_codes, one live row
//      per account). Email verification does NOT approve a teacher.
// The referral code is generated per signup (it used to be generated once per
// server process, so every teacher shared one code). The profile no longer
// stores document links: documents are private and referenced by upload id.
const SIGNUP_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 }; // 10 signups / hour per client
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

function invalid(message: string, code = "invalid") {
  return NextResponse.json({ message, code }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const ipCheck = checkRateLimit(`signup-account:${clientKey(req)}`, SIGNUP_LIMIT);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { message: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds(ipCheck)) } }
    );
  }
  // Fail closed before any side effect if the OTP secret is missing.
  const otpSecret = process.env.INTERNAL_API_SECRET;
  if (!otpSecret) {
    return NextResponse.json({ message: "Verification service unavailable" }, { status: 503 });
  }
  if (!academyFlags.coreSchemaReady) {
    return NextResponse.json({ message: "Teacher applications are not open yet", code: "not_open" }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return invalid("Invalid request body");
  const account = (body.account ?? {}) as Record<string, unknown>;
  const email = normalizeEmail(account.email);
  const password = typeof account.password === "string" ? account.password : "";
  if (!email) return invalid("Enter a valid email address.", "email");
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return invalid(`The password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`, "password");
  }

  let details: ReturnType<typeof parseApplicationDetails>;
  try {
    details = parseApplicationDetails(body.details);
  } catch (error) {
    if (error instanceof DomainError) return invalid(error.message, "details");
    throw error;
  }
  const cvPublicId = verifyUploadReference("teacher_cv", body.cv, otpSecret);
  if (!cvPublicId) return invalid("Upload your CV (PDF) again.", "cv");
  let introVideoPublicId: string | null = null;
  if (body.introVideo !== undefined && body.introVideo !== null) {
    introVideoPublicId = verifyUploadReference("teacher_intro_video", body.introVideo, otpSecret);
    if (!introVideoPublicId) return invalid("Upload your introduction video again.", "intro_video");
  }

  const auth = getAdminAuth();
  let userRecord: { uid: string };
  try {
    userRecord = await auth.createUser({
      email,
      password,
      emailVerified: false,
      displayName: `${details.firstName} ${details.lastName}`.trim(),
    });
  } catch (error) {
    if ((error as { code?: unknown })?.code === "auth/email-already-exists") {
      return NextResponse.json({ message: "email_already_in_use", code: "email_already_in_use" }, { status: 409 });
    }
    console.error("Teacher signup: account creation failed:", (error as { code?: unknown })?.code ?? "unknown");
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }

  try {
    const application = teacherService.planSignupApplication(userRecord.uid, { details, cvPublicId, introVideoPublicId });
    await runGuarded(
      academyExecutor,
      [
        expectRows(
          insertTeacherProfileQuery({ uid: userRecord.uid, email, details, referralCode: generateReferralCode(), createdAt: application.record.createdAt }),
          1,
        ),
        ...application.statements,
      ],
      { unique: "email_already_in_use" },
    );
  } catch (error) {
    // Compensation: no Firebase account may remain without its profile and application.
    await auth.deleteUser(userRecord.uid).catch(() => console.error("Teacher signup: compensation failed for a new account"));
    if (error instanceof DomainError && error.message === "email_already_in_use") {
      return NextResponse.json({ message: "email_already_in_use", code: "email_already_in_use" }, { status: 409 });
    }
    console.error("Teacher signup: recording the application failed:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }

  try {
    // Email verification code (CSPRNG), only its digest stored, then sent.
    const emailCode = generateOtp();
    const digest = hashOtp(userRecord.uid, emailCode, otpSecret);
    await sql`DELETE FROM verification_codes WHERE user_uid = ${userRecord.uid}`;
    await sql`
      INSERT INTO verification_codes (user_uid, email_code, expires_at)
      VALUES (${userRecord.uid}, ${digest}, ${otpExpiry()})
    `;
    await sendEmail(email, "Your Verification Code", verificationCodeEmail(emailCode));
  } catch (error) {
    // The account and application exist; the applicant can request a new code from the verification page.
    console.error("Teacher signup: verification code not sent:", error instanceof Error ? error.name : "unknown");
  }

  return NextResponse.json({ success: true, uid: userRecord.uid }, { status: 201 });
}
