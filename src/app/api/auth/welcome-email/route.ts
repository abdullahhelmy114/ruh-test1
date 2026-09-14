import { NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const { email, firstName } = await request.json();
    if (!email || !firstName) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    await sendWelcomeEmail(email, firstName);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}