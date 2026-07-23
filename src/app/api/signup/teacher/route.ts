import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { sql } from "@/lib/db/client";
import { sendEmailVerificationCode } from "@/lib/email";

// لم نعد بحاجة لاستيراد uploadFile لأن الرفع يتم من المتصفح مباشرة للسحابة

export async function POST(req: NextRequest) {
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
        ${cv_url},                     -- حفظ الرابط السحابي الدائم
        ${video_url || null},          -- حفظ فيديو المقدمة إن وجد
        'teacher',
        'pending',
        ${step1.age || null},
        NOW()
      )
    `;

    // 5. إرسال كود التفعيل للبريد الإلكتروني وتخزينه في الداتابيز
    const emailCode = await sendEmailVerificationCode(step1.email);
    await sql`
      INSERT INTO verification_codes (user_uid, email_code, expires_at)
      VALUES (${userRecord.uid}, ${emailCode}, NOW() + INTERVAL '15 minutes')
    `;

    // 6. إرسال استجابة النجاح للمتصفح (لينتقل لصفحة /verify-teacher)
    return NextResponse.json({ success: true, uid: userRecord.uid }, { status: 201 });

  } catch (error: any) {
    console.error("Teacher signup error:", error);
    // إذا كان الخطأ من Firebase (مثل الإيميل مستخدم مسبقاً) أرسله للعميل
    return NextResponse.json({ message: error.message || "Internal server error" }, { status: 500 });
  }
}