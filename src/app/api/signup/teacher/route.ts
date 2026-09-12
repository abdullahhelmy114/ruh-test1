import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { sql } from "@/lib/db/client";
import { sendEmail, verificationCodeEmail } from "@/lib/email";
import { generateReferralCode } from "@/lib/referral";
import { checkRateLimit, clientKey, retryAfterSeconds } from "@/lib/security/rate-limit";
import { generateOtp, hashOtp, otpExpiry } from "@/lib/security/otp";

const referralCode = generateReferralCode();
// لم نعد بحاجة لاستيراد uploadFile لأن الرفع يتم من المتصفح مباشرة للسحابة

// Phase 3 batch 4 — OTP generation path only. Same change as the student
// route: CSPRNG code from the OTP helper, HMAC digest stored in
// verification_codes (one live row per account), sendEmailVerificationCode
// no longer used, per-client signup limiter. Firebase creation
// (emailVerified: false) and the profile insert (status = 'pending') are
// unchanged; e-mail verification does NOT approve a teacher.
const SIGNUP_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 }; // 10 signups / hour per client

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

  try {
    // 1. استقبال البيانات (JSON) بدلاً من FormData الثقيلة
    const body = await req.json();
    
    const { step1, step2, cv_url, video_url } = body;

    // 2. التحقق من وجود البيانات الأساسية (بما فيها الرابط السحابي للـ CV)
    if (!step1 || !step2 || !cv_url) {
      return NextResponse.json({ message: "Missing required data or CV URL" }, { status: 400 });
    }

    // 3. إنشاء الحساب في Firebase Authentication (كحساب غير مفعل)
    const auth = getAdminAuth();
    const userRecord = await auth.createUser({ 
      email: step1.email, 
      password: step1.password, 
      emailVerified: false 
    });

    const fullName = `${step1.firstName} ${step1.lastName}`.trim();

    // 4. إدخال بيانات المعلم في قاعدة البيانات (PostgreSQL) باستخدام الروابط السحابية الآمنة
    await sql`
INSERT INTO profiles (
  firebase_uid, email, full_name,
  country_of_residence, nationality, gender,
  languages, whatsapp, telegram, social_links,
  bio, cv_url, intro_video_url,
  referral_code,
  role, status, age, created_at
) VALUES (
  ${userRecord.uid},
  ${step1.email},
  ${fullName},
  ${step1.countryOfResidence},
  ${step1.nationality},
  ${step1.gender},
  ${JSON.stringify(step1.languages)},
  ${step1.whatsapp},
  ${step2.telegram},
  ${JSON.stringify(step2.socialLinks || [])},
  ${step2.bio},
  ${cv_url},
  ${video_url || null},
  ${referralCode},
  'teacher',
  'pending',
  ${step1.age || null},
  NOW()
)
    `;

    // 5. توليد كود التفعيل (CSPRNG)، تخزين بصمته فقط، ثم إرساله للبريد الإلكتروني
    const emailCode = generateOtp();
    const digest = hashOtp(userRecord.uid, emailCode, otpSecret);
    await sql`DELETE FROM verification_codes WHERE user_uid = ${userRecord.uid}`;
    await sql`
      INSERT INTO verification_codes (user_uid, email_code, expires_at)
      VALUES (${userRecord.uid}, ${digest}, ${otpExpiry()})
    `;
    await sendEmail(step1.email, "Your Verification Code", verificationCodeEmail(emailCode));

    // 6. إرسال استجابة النجاح للمتصفح (لينتقل لصفحة /verify-teacher)
    return NextResponse.json({ success: true, uid: userRecord.uid }, { status: 201 });

  } catch (error: any) {
    console.error("Teacher signup error:", error);
    // إذا كان الخطأ من Firebase (مثل الإيميل مستخدم مسبقاً) أرسله للعميل
    return NextResponse.json({ message: error.message || "Internal server error" }, { status: 500 });
  }
}