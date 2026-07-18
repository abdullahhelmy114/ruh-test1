import { NextResponse } from "next/server";
import { getAyahIrab, getAyahTafsir, getAyahNozool } from "@/lib/quran-db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const surah = parseInt(searchParams.get("surah") || "1");
  const ayah = parseInt(searchParams.get("ayah") || "1");

  try {
    const words = await getAyahIrab(surah, ayah);
    if (!words.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // تحويل كل كلمة إلى components (قد يكون irab نصاً طويلاً يحتاج لتقسيم)
    const analyzedWords = words.map((w: any) => ({
      word: w.word,
      components: parseIrabComponents(w.irab), // نحلل النص الإعرابي
      meaning: w.meaning,
      root: w.root,
      sarf: w.sarf,
    }));

    return NextResponse.json({ surah, ayah, words: analyzedWords });
  } catch (e) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// دالة مساعدة لتحليل نص الإعراب (مثال: "حرف جر مبني على السكون لا محل له من الإعراب")
function parseIrabComponents(irabText: string) {
  if (!irabText) return [];
  // تقسيم بسيط بناءً على الفواصل أو "لا محل له"
  const parts = irabText.split(/،|؛|\./).filter(p => p.trim());
  return parts.map(p => {
    const text = p.trim();
    let type = "غير محدد";
    if (text.includes("حرف")) type = "حرف";
    else if (text.includes("اسم")) type = "اسم";
    else if (text.includes("فعل")) type = "فعل";
    else if (text.includes("ضمير")) type = "ضمير";
    return { text, type, position: text, sign: text };
  });
}