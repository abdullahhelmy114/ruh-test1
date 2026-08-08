import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { sql } from "@/lib/db/client";
import { sendEmailVerificationCode } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    // 1. استقبال البيانات بصيغة JSON من المتصفح
    const data = await req.json();

    const {
      firstName, lastName, email, password, whatsapp, 
      countryOfResidence, nationality, gender, languages
    } = data;

    // 2. التحقق من وصول كافة البيانات الإجبارية للسيرفر
    if (!firstName || !lastName || !email || !password || !whatsapp || !countryOfResidence || !nationality || !gender || !languages) {
      return NextResponse.json({ message: "All fields are required" }, { status: 400 });
    }

    const auth = getAdminAuth();
    
    // 3. إنشاء الحساب في Firebase (كحساب غير مفعل)
    const userRecord = await auth.createUser({ 
      email, 
      password, 
      emailVerified: false 
    });

    const fullName = `${firstName} ${lastName}`.trim();

    // 4. إدراج بيانات الطالب الكاملة في قاعدة البيانات
    await sql`
      INSERT INTO profiles (
        firebase_uid, email, full_name,
        country_of_residence, nationality, gender,
        languages, whatsapp,
        role, status, created_at
      ) VALUES (
        ${userRecord.uid},
        ${email},
        ${fullName},
        ${countryOfResidence},
        ${nationality},
        ${gender},
        ${JSON.stringify(languages)},
        ${whatsapp},
        'student',
        'pending', -- الحالة 'pending' حتى يقوم بتفعيل الإيميل
        NOW()
      )
    `;

    // 5. إنشاء وإرسال كود التحقق للبريد الإلكتروني
    const emailCode = await sendEmailVerificationCode(email);
    
    // 6. حفظ الكود في قاعدة البيانات لتدقيقه لاحقاً في صفحة /verify-email
    await sql`
      INSERT INTO verification_codes (user_uid, email_code, expires_at)
      VALUES (${userRecord.uid}, ${emailCode}, NOW() + INTERVAL '15 minutes')
    `;

    // 7. إرسال استجابة النجاح للمتصفح
    return NextResponse.json({ success: true, uid: userRecord.uid }, { status: 201 });

  } catch (error: any) {
    console.error("Student signup error:", error);
    
    // التعامل مع خطأ Firebase الشائع (الإيميل مسجل مسبقاً) وإرساله للواجهة لترجمته
    if (error.code === 'auth/email-already-exists') {
      return NextResponse.json({ message: "email_already_in_use" }, { status: 409 });
    }

    return NextResponse.json({ message: error.message || "Internal server error" }, { status: 500 });
  }
}