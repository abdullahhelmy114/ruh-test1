import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { sql } from "@/lib/db/client";
import { sendEmailVerificationCode } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, firstName, lastName, interests, ...optionalFields } = body;

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    const auth = getAdminAuth();
    const userRecord = await auth.createUser({ email, password, emailVerified: false });

    await sql`
      INSERT INTO users (
        uid, email, first_name, last_name,
        country_of_residence, nationality, gender,
        languages, whatsapp, interests, role, status, created_at
      ) VALUES (
        ${userRecord.uid},
        ${email},
        ${firstName},
        ${lastName},
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