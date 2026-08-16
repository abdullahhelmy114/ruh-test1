// app/api/evaluate-writing/route.ts
// تصحيح الكتابة وتقييمها باستخدام Groq

import { NextResponse } from "next/server";
import { evaluateWriting } from "@/lib/ai/evaluate-writing";
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
    const { prompt, userAnswer } = body;

    if (!prompt || !userAnswer) {
      return NextResponse.json(
        { error: "Both prompt and userAnswer are required" },
        { status: 400 }
      );
    }

    const result = await evaluateWriting(prompt, userAnswer);
    return NextResponse.json({ result });
  } catch (error: any) {
    console.error("Error evaluating writing:", error);
    return NextResponse.json(
      { error: error.message || "Failed to evaluate writing" },
      { status: 500 }
    );
  }
}