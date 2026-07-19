// lib/quran-db.ts
import { sql } from "@/lib/db/client";

function extractTypeFromIrab(irabText: string): string {
  const text = irabText.toLowerCase();
  if (text.includes("حرف جر") || text.includes("حرف عطف") || text.includes("حرف نفي") || text.includes("حرف استئناف") || text.includes("حرف شرط")) return "حرف";
  if (text.includes("فعل ماض") || text.includes("فعل مضارع") || text.includes("فعل أمر")) return "فعل";
  if (text.includes("اسم فاعل") || text.includes("اسم مفعول")) return "اسم";
  if (text.includes("ضمير")) return "ضمير";
  if (text.includes("اسم إشارة")) return "اسم_اشارة";
  if (text.includes("اسم موصول")) return "اسم_موصول";
  if (text.includes("ظرف")) return "ظرف";
  if (text.includes("مصدر")) return "اسم";
  return "اسم";
}

function extractPositionFromIrab(irabText: string): string {
  const text = irabText.toLowerCase();
  if (text.includes("مبتدأ")) return "مبتدأ";
  if (text.includes("خبر")) return "خبر";
  if (text.includes("فاعل")) return "فاعل";
  if (text.includes("مفعول به")) return "مفعول_به";
  if (text.includes("مفعول مطلق")) return "مفعول_مطلق";
  if (text.includes("مضاف إليه")) return "مضاف_إليه";
  if (text.includes("مجرور")) return "مجرور_بحرف_جر";
  if (text.includes("نعت") || text.includes("صفة")) return "نعت";
  if (text.includes("حال")) return "حال";
  if (text.includes("بدل")) return "بدل";
  if (text.includes("معطوف")) return "معطوف";
  if (text.includes("تمييز")) return "تمييز";
  return irabText.substring(0, 50); // أول 50 حرف كملخص
}

function extractSignFromIrab(irabText: string): string {
  const text = irabText.toLowerCase();
  if (text.includes("مرفوع")) return "مرفوع";
  if (text.includes("منصوب")) return "منصوب";
  if (text.includes("مجرور")) return "مجرور";
  if (text.includes("مجزوم")) return "مجزوم";
  if (text.includes("مبني")) return "مبني";
  if (text.includes("لا محل له")) return "لا محل له من الإعراب";
  return "";
}

export async function getAyahIrab(surah: number, ayah: number) {
  const rows = await sql`
    SELECT word_text, components FROM surahpedia_irab
    WHERE surah_number = ${surah} AND ayah_number = ${ayah}
    ORDER BY word_position
  `;

  return rows.map((w: any) => {
    let components = typeof w.components === "string"
      ? JSON.parse(w.components)
      : w.components;

    // إذا كانت المكونات فارغة أو غير محددة، نعيد بناءها من النص الإعرابي
    if (!components || components.length === 0 || components[0].type === "غير محدد") {
      const irabText = components?.[0]?.position || "";
      components = [{
        text: w.word_text,
        type: extractTypeFromIrab(irabText),
        position: extractPositionFromIrab(irabText),
        sign: extractSignFromIrab(irabText)
      }];
    }

    return {
      word: w.word_text,
      components
    };
  });
}