// lib/quran-api.ts

const cache = new Map<string, any>();

export async function fetchTranslation(surah: number, ayah: number, lang: "en" | "tr") {
  const key = `${surah}:${ayah}:${lang}`;
  if (cache.has(key)) return cache.get(key);

  const edition = lang === "en" ? "en.asad" : "tr.diyanet";
  const res = await fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/editions/${edition}`);
  const data = await res.json();
  const text = data?.data?.[0]?.text || "";
  cache.set(key, text);
  return text;
}

export function getAyahAudioUrl(surah: number, ayah: number) {
  // المصدر الموثوق والمفتوح: EveryAyah.com - تلاوة الحذيفي (مجمع الملك فهد)
  // يتم تنسيق رقم الآية بشكل عالمي
  return `https://everyayah.com/data/Hudhaifi_64kbps/${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`;
}

export function getWordAudioUrl(surah: number, ayah: number, wordPosition: number) {
  // المصدر المفتوح: مستودع QuranWBW على GitHub
  return `https://raw.githubusercontent.com/qazasaz/quranwbw/main/audio/${surah}/${ayah}/${wordPosition}.mp3`;
}