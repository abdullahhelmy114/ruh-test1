const fs = require('fs');

const sqlContent = fs.readFileSync('quran.sql', 'utf-8');
const outputLines = [];

// نبحث عن أي 4 قيم داخل قوسين: (رقم, رقم, رقم, 'نص')
const tupleRegex = /\((\d+),\s*(\d+),\s*(\d+),\s*'((?:[^'\\]|\\.)*)'\)/g;
let match;

while ((match = tupleRegex.exec(sqlContent)) !== null) {
  const sura = parseInt(match[2], 10);
  const aya  = parseInt(match[3], 10);
  let text   = match[4].replace(/\\'/g, "'").trim();

  // إزالة البسملة المدمجة من أول آية في كل سورة (عدا الفاتحة والتوبة)
  if (aya === 1 && sura !== 1 && sura !== 9) {
    const words = text.split(/\s+/);
    if (words.length >= 4 &&
        words[0].startsWith('بِسْمِ') &&
        words[1].startsWith('ٱللَّهِ') &&
        words[2].startsWith('ٱلرَّحْمَـٰنِ') &&
        words[3].startsWith('ٱلرَّحِيمِ')) {
      text = words.slice(4).join(' ');
    }
  }

  if (text.length > 0) {
    const words = text.split(/\s+/);
    words.forEach((word, idx) => {
      outputLines.push(`${sura}|${aya}|${idx + 1}|${word}`);
    });
  }
}

fs.writeFileSync('quran_words.txt', outputLines.join('\n'), 'utf-8');
console.log(`✅ تم بنجاح. ${outputLines.length} كلمة قرآنية.`);