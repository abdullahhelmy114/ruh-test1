// app/api/evaluate-speaking/route.ts
// تقييم نطق الطالب باستخدام Groq

import { NextResponse } from "next/server";
import { evaluateSpeaking } from "@/lib/ai/evaluate-speaking";
import { firebaseAdmin } from "@/lib/firebase-admin";

async function verifyUser(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.split("Bearer ")[1];

  try {
    await firebaseAdmin.auth().verifyIdToken(token);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!(await verifyUser(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { expectedText, actualText } = body;

    if (!expectedText || !actualText) {
      return NextResponse.json(
        { error: "Both expectedText and actualText are required" },
        { status: 400 }
      );
    }

    const result = await evaluateSpeaking(expectedText, actualText);
    return NextResponse.json({ result });
  } catch (error: any) {
    console.error("Error evaluating speaking:", error);
    return NextResponse.json(
      { error: error.message || "Failed to evaluate speaking" },
      { status: 500 }
    );
  }
}