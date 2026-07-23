import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { verifyIdToken } from "@/lib/firebase/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    // حماية الـ API (للأدمن فقط)
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, type } = await req.json();
    if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

    // اختيار النموذج (Flash سريع جداً وممتاز لهذه المهام)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let systemPrompt = prompt;
    if (type === "quiz") {
      systemPrompt = `Generate a 3-question multiple choice quiz based on this topic: "${prompt}". 
      Return ONLY a valid JSON array of objects with this exact structure: 
      [{"question": "...", "options": [{"text": "...", "label": "A"}], "correctIndex": 0, "explanation": "..."}]`;
    }

    const result = await model.generateContent(systemPrompt);
    const text = result.response.text();

    return NextResponse.json({ success: true, text });
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return NextResponse.json({ error: "Failed to generate content" }, { status: 500 });
  }
}