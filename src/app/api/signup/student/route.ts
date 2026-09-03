import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { sql } from "@/lib/db/client";
import { sendEmailVerificationCode } from "@/lib/email";
import { generateReferralCode } from "@/lib/referral";

export async function POST(req: NextRequest) {
  try {
    // 1. استقبال البيانات بصيغة JSON من المتصفح
    const data = await req.json();

    const {
      firstName,
      lastName,
      email,
      password,
      whatsapp,
      countryOfResidence,
      nationality,
      gender,
      languages,
      referral_code, // كود إحالة الصديق (اختياري)
    } = data;

    // 2. التحقق من وصول كافة البيانات الإجبارية للسيرفر
    if (
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !whatsapp ||
      !countryOfResidence ||
      !nationality ||
      !gender ||
      !languages
    ) {
      return NextResponse.json(
        { message: "All fields are required" },
        { status: 400 }
      );
    }

    const auth = getAdminAuth();

    // 3. إنشاء الحساب في Firebase (كحساب غير مفعل)
    const userRecord = await auth.createUser({
      email,
      password,
      emailVerified: false,
    });

    const fullName = `${firstName} ${lastName}`.trim();

    // 4. توليد كود إحالة جديد للطالب الجديد (يُنشأ لكل طلب)
    const newReferralCode = generateReferralCode();

    // 5. البحث عن المُحيل (إن وُجد)
    let referredBy: string | null = null;
    if (referral_code && referral_code.trim()) {
      const referrer = await sql`
        SELECT id
        FROM profiles
        WHERE referral_code = ${referral_code.trim()}
        LIMIT 1
      `;
      if (referrer.length > 0) {
        referredBy = referrer[0].id;
      }
    }

    // 6. إدراج بيانات الطالب الكاملة في قاعدة البيانات
    await sql`
      INSERT INTO profiles (
        firebase_uid,
        email,
        full_name,
        country_of_residence,
        nationality,
        gender,
        languages,
        whatsapp,
        referral_code,
        referred_by,
        role,
        status,
        created_at
      ) VALUES (
        ${userRecord.uid},
        ${email},
        ${fullName},
        ${countryOfResidence},
        ${nationality},
        ${gender},
        ${JSON.stringify(languages)},
        ${whatsapp},
        ${newReferralCode},
        ${referredBy},
        'student',
        'pending',
        NOW()
      )
    `;

    // 7. إنشاء وإرسال كود التحقق للبريد الإلكتروني
    const emailCode = await sendEmailVerificationCode(email);

    // 8. حفظ الكود في قاعدة البيانات لتدقيقه لاحقاً في صفحة /verify-email
    await sql`
      INSERT INTO verification_codes (user_uid, email_code, expires_at)
      VALUES (${userRecord.uid}, ${emailCode}, NOW() + INTERVAL '15 minutes')
    `;

    // 9. إرسال استجابة النجاح للمتصفح
    return NextResponse.json(
      { success: true, uid: userRecord.uid },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Student signup error:", error);

    // التعامل مع خطأ Firebase الشائع (الإيميل مسجل مسبقاً)
    if (error.code === "auth/email-already-exists") {
      return NextResponse.json(
        { message: "email_already_in_use" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}