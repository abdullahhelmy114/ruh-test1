import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { sql } from "@/lib/db/client";
import { sendEmailVerificationCode } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // 🔥 إضافة استخراج العمر (age)
    const { email, password, firstName, lastName, age, interests, ...optionalFields } = body;

    // 🔥 التأكد من أن العمر موجود وإلزامي
    if (!email || !password || !firstName || !lastName || !age) {
      return NextResponse.json({ message: "Missing required fields including age" }, { status: 400 });
    }

    const auth = getAdminAuth();
    const userRecord = await auth.createUser({ email, password, emailVerified: false });

    // 🔥 تم إصلاح دمج الاسم وإضافة العمر
    const fullName = `${firstName} ${lastName}`.trim();

    await sql`
      INSERT INTO profiles (
        firebase_uid, email, full_name, age,
        country_of_residence, nationality, gender,
        languages, whatsapp, interests, role, status, created_at
      ) VALUES (
        ${userRecord.uid},
        ${email},
        ${fullName},
        ${parseInt(age)},
        ${optionalFields.countryOfResidence || null},
        ${optionalFields.nationality || null},
        ${optionalFields.gender || null},
        ${JSON.stringify(optionalFields.languages || [])},
        ${optionalFields.whatsapp || null},
        ${interests || null},
        'student',
        'inactive',
        NOW()
      )
    `;

    const emailCode = await sendEmailVerificationCode(email);
    await sql`
      INSERT INTO verification_codes (user_uid, email_code, expires_at)
      VALUES (${userRecord.uid}, ${emailCode}, NOW() + INTERVAL '15 minutes')
    `;

    return NextResponse.json({ success: true, uid: userRecord.uid }, { status: 201 });
  } catch (error: any) {
    console.error("Student signup error:", error);
    return NextResponse.json({ message: error.message || "Internal server error" }, { status: 500 });
  }
}