import { readFileSync, writeFileSync } from "fs";

const raw = readFileSync("data/quranic-corpus-morphology.txt", "utf-8");
const lines = raw.split("\n").filter(line => line.trim() !== "");

const quran = {};
let currentAyah = null;

for (const line of lines) {
  const parts = line.split("\t");
  if (parts.length < 4) continue;

  const locMatch = parts[0].match(/\((\d+):(\d+):(\d+):(\d+)\)/);
  if (!locMatch) continue;

  const surah = parseInt(locMatch[1]);
  const ayah = parseInt(locMatch[2]);
  const wordNum = parseInt(locMatch[3]);
  const segmentNum = parseInt(locMatch[4]);
  const form = parts[1].replace(/[{<~}]/g, ""); // تنظيف الرموز
  const tag = parts[2];
  const features = parts[3];

  const key = `${surah}:${ayah}`;
  if (!quran[key]) quran[key] = { surah, ayah, words: {} };
  if (!quran[key].words[wordNum]) quran[key].words[wordNum] = { text: "", segments: [] };

  // نجمع النص الكامل للكلمة من مقاطعها
  if (segmentNum === 1) {
    quran[key].words[wordNum].text = form;
  }

  quran[key].words[wordNum].segments.push({
    text: form,
    tag: tag,
    features: features
  });
}

// تحويل إلى مصفوفة للاستخدام
const result = Object.values(quran).map(entry => ({
  ...entry,
  words: Object.values(entry.words)
}));

writeFileSync("data/quran-corpus-cleaned.json", JSON.stringify(result, null, 2));
console.log(`✅ تم إنشاء quran-corpus-cleaned.json`);