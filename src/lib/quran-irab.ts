// lib/quran-irab.ts
import { sql } from "@/lib/db/client";
import { QuranicTags } from "./quranic-tags";

function getIrabFromSegment(tag: string, features: string): { type: string; position: string; sign: string } {
  const type = QuranicTags[tag] || tag;
  const feats = features.split("|");
  let position = "";
  let sign = "";

  // الحالات الإعرابية
  if (feats.includes("NOM")) { position = "مرفوع"; sign = "مرفوع"; }
  else if (feats.includes("ACC")) { position = "منصوب"; sign = "منصوب"; }
  else if (feats.includes("GEN")) { position = "مجرور"; sign = "مجرور"; }
  else if (feats.includes("JUS")) { position = "مجزوم"; sign = "مجزوم"; }

  // الزمن
  if (feats.includes("PERF")) position += " (ماض)";
  else if (feats.includes("IMPF")) position += " (مضارع)";
  else if (feats.includes("IMP")) position += " (أمر)";

  // الحروف
  if (["P", "PREP", "CONJ", "REM", "NEG", "FUT", "VOC", "AMD", "ANS", "CERT", "EXH", "SUB", "SUP", "RSLT", "DET", "EMPH", "CAUS", "INC", "INT", "PREV", "PRO", "RET", "SUR", "ATT", "DIST", "ADDR", "T", "LOC", "NV", "INL", "COND", "INTG", "EQ", "EXP"].includes(tag)) {
    position = "لا محل له من الإعراب";
    sign = "مبني";
  }

  // الضمائر والمبنيات
  if (["PRON", "DEM", "REL"].includes(tag)) {
    position = "مبني";
    if (feats.includes("NOM")) position += " في محل رفع";
    else if (feats.includes("ACC")) position += " في محل نصب";
    else if (feats.includes("GEN")) position += " في محل جر";
    sign = "مبني";
  }

  return { type, position, sign };
}

export async function getAyahIrab(surah: number, ayah: number) {
  const words = await sql`
    SELECT w.word_text, w.word_position,
           json_agg(json_build_object(
             'text', s.segment_text,
             'tag', s.tag,
             'features', s.features
           ) ORDER BY s.segment_number) as segments
    FROM quran_corpus_words w
    JOIN quran_corpus_segments s ON s.word_id = w.id
    WHERE w.surah_number = ${surah} AND w.ayah_number = ${ayah}
    GROUP BY w.id, w.word_text, w.word_position
    ORDER BY w.word_position
  `;

  return words.map((w: any) => ({
    word: w.word_text,
    components: w.segments.map((seg: any) => ({
      text: seg.text || w.word_text, // 👈 هنا أضفنا الخاصية التي كانت تسبب المشكلة
      ...getIrabFromSegment(seg.tag, seg.features)
    }))
  }));
}