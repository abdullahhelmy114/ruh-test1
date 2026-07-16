import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { sql } from "@/lib/db/client";
import { sendEmailVerificationCode } from "@/lib/email";
import { uploadFile } from "@/lib/upload-file";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const step1Str = formData.get("step1") as string | null;
    const step2Str = formData.get("step2") as string | null;
    const cvFile = formData.get("cv") as File | null;
    const introVideo = formData.get("introVideo") as File | null;

    if (!step1Str || !step2Str || !cvFile) {
      return NextResponse.json({ message: "Missing required data" }, { status: 400 });
    }

    const step1 = JSON.parse(step1Str);
    const step2 = JSON.parse(step2Str);

    const auth = getAdminAuth();
    const userRecord = await auth.createUser({ email: step1.email, password: step1.password, emailVerified: false });

    const cvResult = await uploadFile(cvFile, "cvs", userRecord.uid);
    let introVideoUrl: string | null = null;
    if (introVideo) {
      const videoResult = await uploadFile(introVideo, "videos", userRecord.uid);
      introVideoUrl = videoResult.url;
    }

    const fullName = `${step1.firstName} ${step1.lastName}`.trim();

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
        ${cvResult.url},
        ${introVideoUrl},
        'teacher',
        'pending',
        ${step1.age || null},
        NOW()
      )
    `;

    const emailCode = await sendEmailVerificationCode(step1.email);
    await sql`
      INSERT INTO verification_codes (user_uid, email_code, expires_at)
      VALUES (${userRecord.uid}, ${emailCode}, NOW() + INTERVAL '15 minutes')
    `;

    return NextResponse.json({ success: true, uid: userRecord.uid }, { status: 201 });
  } catch (error: any) {
    console.error("Teacher signup error:", error);
    return NextResponse.json({ message: error.message || "Internal server error" }, { status: 500 });
  }
}