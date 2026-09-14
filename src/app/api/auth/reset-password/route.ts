import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const auth = getAdminAuth();
    const resetLink = await auth.generatePasswordResetLink(email, {
      url: "https://ruhulqudus.com/reset-password",
    });

    await sendPasswordResetEmail(email, resetLink);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
}