import { NextResponse } from "next/server";
import { getAyahIrab } from "@/lib/quran-irab"; // تم تصحيح مسار الاستيراد هنا

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const surah = parseInt(searchParams.get("surah") || "1");
  const ayah = parseInt(searchParams.get("ayah") || "1");

  try {
    const words = await getAyahIrab(surah, ayah);
    
    if (words.length === 0) {
      return NextResponse.json({ error: "Ayah not found or no Irab data available" }, { status: 404 });
    }
    
    return NextResponse.json({ surah, ayah, words });
  } catch (error) {
    console.error("Irab API error:", error);
    return NextResponse.json({ error: "Internal server error while fetching Irab" }, { status: 500 });
  }
}