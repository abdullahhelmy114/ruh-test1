// scripts/import-contemporary.js
// استخراج معجم اللغة العربية المعاصرة من ملف نصي وتحويله إلى JSON

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = path.join(__dirname, '..', 'data', 'mo3jam-contemporary.txt');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'mo3jam-contemporary.json');

const text = fs.readFileSync(INPUT_FILE, 'utf8');
const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);

// تحويل الأرقام العربية المشرقية إلى إنجليزية
function convertArabicDigits(input) {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const englishDigits = '0123456789';
  return input.replace(/[٠-٩]/g, (d) => englishDigits[arabicDigits.indexOf(d)]);
}

let entries = [];
let currentEntry = null;
let parsingStarted = false;

function finalizeCurrentEntry() {
  if (currentEntry) {
    // نتجاهل المدخل إذا لم يكن لديه كلمة
    if (currentEntry.word) {
      currentEntry.meanings = currentEntry.meanings.filter(m => m.definition && m.definition.trim().length > 0);
      entries.push(currentEntry);
    }
    currentEntry = null;
  }
}

// سطر الجذر: "1 - أ" أو "١ - أ ا"
const rootLineRegex = /^(\d+)\s*-\s*([\u0621-\u064A\s]+)$/;

// سطر الكلمة مع [نوع]: "آب [مفرد] : ..."
const wordLineWithTypeRegex = /^(.+?)\s*\[([^\]]+)\]\s*:?\s*(.*)$/;

// سطر الكلمة بدون [نوع]: نبحث عن أول فاصلة أو نقطتين
const wordLineNoTypeRegex = /^(.+?)[،:]\s*(.*)$/;

// معلومات الصفحة: "الجزء: 1 - الصفحة: 50"
const pageInfoRegex = /^الجزء:\s*(\d+)\s*-\s*الصفحة:\s*(\d+)$/;

// نمط سطر يحتوي فقط على حروف عربية ومسافات (جذر منفصل)
const standaloneRootRegex = /^[\u0621-\u064A\s]+$/;

for (let i = 0; i < lines.length; i++) {
  const line = convertArabicDigits(lines[i]);

  // تجاهل الأسطر الجذرية المنفصلة إذا كان التالي سطر رقم-جذر
  if (standaloneRootRegex.test(line) && i + 1 < lines.length && rootLineRegex.test(convertArabicDigits(lines[i + 1]))) {
    continue;
  }

  // تجاهل المقدمة حتى نجد أول سطر رقم-جذر
  if (!parsingStarted) {
    if (rootLineRegex.test(line)) {
      parsingStarted = true;
      finalizeCurrentEntry();
      const match = line.match(rootLineRegex);
      currentEntry = {
        entry_number: parseInt(match[1]),
        root: match[2].trim(),
        word: null,
        word_type: null,
        meanings: [],
        part: null,
        page: null,
      };
    }
    continue;
  }

  // بداية مدخل جديد
  if (rootLineRegex.test(line)) {
    finalizeCurrentEntry();
    const match = line.match(rootLineRegex);
    currentEntry = {
      entry_number: parseInt(match[1]),
      root: match[2].trim(),
      word: null,
      word_type: null,
      meanings: [],
      part: null,
      page: null,
    };
    continue;
  }

  // معلومات الصفحة
  if (pageInfoRegex.test(line)) {
    if (currentEntry) {
      const match = line.match(pageInfoRegex);
      currentEntry.part = parseInt(match[1]);
      currentEntry.page = parseInt(match[2]);
    }
    continue;
  }

  // التقاط سطر الكلمة إذا لم نكن قد التقطناه بعد
  if (currentEntry && !currentEntry.word) {
    // أولاً نحاول مع [نوع]
    let wordMatch = line.match(wordLineWithTypeRegex);
    if (wordMatch) {
      currentEntry.word = wordMatch[1].trim();
      currentEntry.word_type = wordMatch[2].trim();
      const rest = wordMatch[3].trim();
      if (rest) {
        currentEntry.meanings.push({ definition: rest });
      }
      continue;
    }

    // إذا لم يوجد [نوع]، نبحث عن فاصلة أو نقطتين
    wordMatch = line.match(wordLineNoTypeRegex);
    if (wordMatch) {
      currentEntry.word = wordMatch[1].trim();
      currentEntry.word_type = null; // بدون نوع
      const rest = wordMatch[2].trim();
      if (rest) {
        currentEntry.meanings.push({ definition: rest });
      }
      continue;
    }
  }

  // معالجة المعاني بعد التقاط الكلمة
  if (currentEntry && currentEntry.word) {
    if (/^\d+\s*-\s*/.test(line)) {
      const cleaned = line.replace(/^\d+\s*-\s*/, '').trim();
      if (cleaned) {
        currentEntry.meanings.push({ definition: cleaned });
      }
      continue;
    }

    if (line.startsWith('•')) {
      const cleaned = line.replace(/^•\s*/, '').trim();
      if (cleaned) {
        currentEntry.meanings.push({ definition: cleaned });
      }
      continue;
    }

    // أي سطر آخر يُلحق بآخر معنى
    if (line.trim().length > 0) {
      if (currentEntry.meanings.length > 0) {
        currentEntry.meanings[currentEntry.meanings.length - 1].definition += ' ' + line;
      } else {
        currentEntry.meanings.push({ definition: line });
      }
    }
  }
}

finalizeCurrentEntry();

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(entries, null, 2), 'utf8');
console.log(`✅ تم استخراج ${entries.length} مدخل بنجاح.`);
console.log(`📄 الملف المحفوظ: ${OUTPUT_FILE}`);