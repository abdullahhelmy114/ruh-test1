import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const surah = searchParams.get("surah");
  const ayah = searchParams.get("ayah");

  if (!surah || !ayah) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    // جلب التفسير الميسر من API موثوق ومجاني
    const response = await fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/ar.muyassar`);
    const data = await response.json();

    if (data && data.data) {
      return NextResponse.json({ tafsir: data.data.text });
    }
    
    return NextResponse.json({ tafsir: "لا يوجد تفسير متاح حالياً لهذه الآية." });
  } catch (error) {
    console.error("Tafsir error:", error);
    return NextResponse.json({ error: "تعذر تحميل التفسير" }, { status: 500 });
  }
}