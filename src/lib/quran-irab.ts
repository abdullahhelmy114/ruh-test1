import { sql } from "@/lib/db/client";
import { QuranicTags } from "./quranic-tags";

// ==========================================
// 🔠 القاموس الشامل (مضاف إليه كل الرموز الناقصة)
// ==========================================
const buckwalterToArabic: Record<string, string> = {
  "'": "ء", "|": "آ", "?": "أ", ">": "أ", "&": "ؤ", "<": "إ", "}": "ئ",
  "A": "ا", "b": "ب", "p": "ة", "t": "ت", "v": "ث", "j": "ج",
  "H": "ح", "x": "خ", "d": "د", "*": "ذ", "r": "ر", "z": "ز",
  "s": "س", "$": "ش", "S": "ص", "D": "ض", "T": "ط", "Z": "ظ",
  "E": "ع", "g": "غ", "f": "ف", "q": "ق", "k": "ك", "l": "ل",
  "m": "م", "n": "ن", "h": "ه", "w": "و", "Y": "ى", "y": "ي",
  "F": "ً", "N": "ٌ", "K": "ٍ", "a": "َ", "u": "ُ", "i": "ِ",
  "~": "ّ", "o": "ْ", "`": "ٰ", "{": "ٱ", "^": "ٰ", "@": "۟",
  "\"": "۠", "[": "ۜ", "_": "ٖ", "+": "ۥ", "%": "ۦ", "#": "۩",
  "I": "إ", "O": "أ", "W": "ؤ"
};

function decodeFranco(text: string) {
  if (!text) return "";
  return text.split('').map(char => buckwalterToArabic[char] || char).join('');
}

function getIrabFromSegment(tag: string, features: string): { type: string; position: string; sign: string } {
  let type = QuranicTags[tag] || tag;
  if (tag === "ACC") type = "حرف نصب (ناسخ)"; 
  if (tag === "PRP") type = "حرف تعليل"; 
  if (tag === "AVD") type = "حرف امتناع"; 
  
  const feats = features.split("|");
  let position = "";
  let sign = "";

  if (feats.includes("NOM")) { position = "مرفوع"; sign = "علامة رفعه الضمة (أو ما ينوب عنها)"; }
  else if (feats.includes("ACC")) { position = "منصوب"; sign = "علامة نصبه الفتحة (أو ما ينوب عنها)"; }
  else if (feats.includes("GEN")) { position = "مجرور"; sign = "علامة جره الكسرة (أو ما ينوب عنها)"; }
  else if (feats.includes("JUS")) { position = "مجزوم"; sign = "علامة جزمه السكون (أو ما ينوب عنه)"; }

  if (feats.includes("PERF")) position = "فعل ماضٍ";
  else if (feats.includes("IMPF")) position = "فعل مضارع " + position;
  else if (feats.includes("IMP")) { position = "فعل أمر"; sign = "مبني"; }

  if (["P", "PREP", "CONJ", "REM", "NEG", "FUT", "VOC", "AMD", "ANS", "CERT", "EXH", "SUB", "SUP", "RSLT", "DET", "EMPH", "CAUS", "INC", "INT", "PREV", "PRO", "RET", "SUR", "ATT", "DIST", "ADDR", "T", "LOC", "NV", "INL", "COND", "INTG", "EQ", "EXP", "CIRC", "COM", "RES", "PRP", "AVD"].includes(tag)) {
    position = "لا محل له من الإعراب";
    sign = "مبني";
  }

  if (["PRON", "DEM", "REL"].includes(tag)) {
    position = "مبني";
    if (feats.includes("NOM")) position += " في محل رفع";
    else if (feats.includes("ACC")) position += " في محل نصب";
    else if (feats.includes("GEN")) position += " في محل جر";
    sign = "مبني";
  }

  return { type, position: position || "حسب موقعه", sign: sign || "-" };
}

export async function getAyahIrab(surah: number, ayah: number) {
  const words = await sql`
    SELECT w.id, w.word_position,
           json_agg(json_build_object(
             'text', s.segment_text,
             'tag', s.tag,
             'features', s.features
           ) ORDER BY s.segment_number) as segments
    FROM quran_corpus_words w
    JOIN quran_corpus_segments s ON s.word_id = w.id
    WHERE w.surah_number = ${surah} AND w.ayah_number = ${ayah}
    GROUP BY w.id, w.word_position
    ORDER BY w.word_position
  `;

  return words.map((w: any) => {
    // 1. ترجمة المقاطع من الفرانكو للعربي فوراً
    const processedSegments = w.segments.map((seg: any) => {
      return {
        text: decodeFranco(seg.text),
        ...getIrabFromSegment(seg.tag, seg.features)
      };
    }).filter((comp: any) => comp.text && comp.text.trim() !== "");

    // 2. 🪄 تجميع الكلمة الكبيرة من المقاطع المعربة (لكي لا نعتمد على الداتا بيز المختربة)
    const reconstructedWord = processedSegments.map((seg: any) => seg.text).join('');

    return {
      word: reconstructedWord,
      components: processedSegments
    };
  });
}