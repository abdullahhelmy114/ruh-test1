import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { sendVerificationEmail } from "@/lib/email";
import { randomBytes } from "crypto";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const code = randomBytes(3).toString("hex").toUpperCase(); // 6 أحرف

    await sendVerificationEmail(email, code);

    await sql`
      INSERT INTO verification_codes (email, code, expires_at)
      VALUES (${email}, ${code}, NOW() + INTERVAL '15 minutes')
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}