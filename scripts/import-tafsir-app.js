import axios from "axios";
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const sql = neon(process.env.DATABASE_URL);
const BASE_URL = "https://tafsir.app/get.php";
const SOURCE = "iraab-daas";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchIrab(surah, ayah) {
  const url = `${BASE_URL}?src=${SOURCE}&s=${surah}&a=${ayah}&ver=1`;
  const { data } = await axios.get(url, {
    headers: { "User-Agent": "Ruhulqudus/1.0" }
  });
  return data;
}

function parseIrabText(text) {
  const words = [];
  const parts = text.split(/،|؛|\./).filter(p => p.trim());
  for (const part of parts) {
    const trimmed = part.trim();
    const match = trimmed.match(/^([ء-ي]+)\s+(.+)$/);
    if (match) {
      words.push({ text: match[1], irab: match[2] });
    }
  }
  return words;
}

async function importAll() {
  console.log("📖 بدء استيراد إعراب القرآن من tafsir.app...");

  const surahLengths = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

  for (let surah = 1; surah <= 114; surah++) {
    const ayahCount = surahLengths[surah - 1];
    for (let ayah = 1; ayah <= ayahCount; ayah++) {
      try {
        const data = await fetchIrab(surah, ayah);
        if (data && data.data) {
          const words = parseIrabText(data.data);
          for (let i = 0; i < words.length; i++) {
            await sql`
              INSERT INTO surahpedia_irab (surah_number, ayah_number, word_position, word_text, components)
              VALUES (${surah}, ${ayah}, ${i + 1}, ${words[i].text}, ${JSON.stringify([{ text: words[i].text, type: "غير محدد", position: words[i].irab, sign: "" }])})
              ON CONFLICT (surah_number, ayah_number, word_position) DO UPDATE
              SET components = ${JSON.stringify([{ text: words[i].text, type: "غير محدد", position: words[i].irab, sign: "" }])}
            `;
          }
          console.log(`✅ ${surah}:${ayah}`);
        }
      } catch (err) {
        console.error(`❌ ${surah}:${ayah}`, err.message);
      }
      await delay(200);
    }
    console.log(`🎉 سورة ${surah} تمت`);
  }
  console.log("🎉 تم استيراد جميع الآيات!");
  process.exit(0);
}

importAll();