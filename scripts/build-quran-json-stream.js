// scripts/build-quran-json-stream.js
import fs from 'fs';
import readline from 'readline';
import { Transform, pipeline } from 'stream';

const INPUT_FILE = 'data/quranic-corpus-morphology.txt';
const OUTPUT_FILE = 'data/quran-corpus-cleaned.json';

// خريطة مؤقتة لتجميع الآيات
const quran = new Map();

function processLine(line) {
  if (!line.startsWith('(')) return;
  const parts = line.split('\t');
  if (parts.length < 4) return;

  const locMatch = parts[0].match(/\((\d+):(\d+):(\d+):(\d+)\)/);
  if (!locMatch) return;

  const surah = parseInt(locMatch[1]);
  const ayah = parseInt(locMatch[2]);
  const wordNum = parseInt(locMatch[3]);
  const segmentNum = parseInt(locMatch[4]);
  const form = parts[1].replace(/[{<~}]/g, ''); // تنظيف الرموز
  const tag = parts[2];
  const features = parts[3].trim();

  const key = `${surah}:${ayah}`;
  if (!quran.has(key)) {
    quran.set(key, { surah, ayah, words: new Map() });
  }
  const entry = quran.get(key);
  if (!entry.words.has(wordNum)) {
    entry.words.set(wordNum, { text: '', segments: [] });
  }
  const word = entry.words.get(wordNum);
  if (segmentNum === 1) {
    word.text = form;
  }
  word.segments.push({ text: form, tag, features });
}

// تحويل الخريطة إلى JSON نهائي
function finalizeJSON() {
  const result = [];
  for (const [key, entry] of quran) {
    const wordsArray = [];
    const sortedWordNums = Array.from(entry.words.keys()).sort((a, b) => a - b);
    for (const num of sortedWordNums) {
      wordsArray.push(entry.words.get(num));
    }
    result.push({
      surah: entry.surah,
      ayah: entry.ayah,
      words: wordsArray
    });
  }
  // ترتيب حسب السورة ثم الآية
  result.sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
  return JSON.stringify(result, null, 2);
}

async function main() {
  console.log('📖 بدء معالجة الملف الكبير...');
  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT_FILE),
    crlfDelay: Infinity
  });

  let count = 0;
  for await (const line of rl) {
    processLine(line);
    count++;
    if (count % 100000 === 0) {
      console.log(`   تمت معالجة ${count} سطر...`);
    }
  }

  console.log(`✅ تمت معالجة ${count} سطر. جاري كتابة JSON...`);

  const json = finalizeJSON();
  fs.writeFileSync(OUTPUT_FILE, json);
  console.log(`🎉 تم إنشاء ${OUTPUT_FILE} بنجاح.`);
}

main().catch(err => {
  console.error('❌ فشل:', err);
  process.exit(1);
});