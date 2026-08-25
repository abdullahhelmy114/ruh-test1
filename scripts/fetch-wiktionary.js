// scripts/fetch-wiktionary.js
// جلب الكلمات من DBnary (ويكاموس) وحفظها في ملف JSON

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPARQL_ENDPOINT = 'https://kaiko.getalp.org/sparql';
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'wiktionary-words.json');

const buildQuery = (offset, limit) => `
PREFIX ontolex: <http://www.w3.org/ns/lemon/ontolex#>
PREFIX dbnary: <http://kaiko.getalp.org/dbnary#>
PREFIX lexinfo: <http://www.lexinfo.net/ontology/2.0/lexinfo#>

SELECT DISTINCT ?word ?plural ?antonym ?meaningEn ?meaningTr
WHERE {
  ?entry a ontolex:LexicalEntry ;
         ontolex:canonicalForm ?form .
  ?form ontolex:writtenRep ?word .
  FILTER (lang(?word) = "ar")

  OPTIONAL { ?entry dbnary:plural ?plural }
  OPTIONAL { ?entry dbnary:antonym ?antonym }
  OPTIONAL {
    ?entry ontolex:sense ?sense .
    ?sense dbnary:gloss ?meaningEn .
    FILTER (lang(?meaningEn) = "en")
  }
  OPTIONAL {
    ?entry ontolex:sense ?sense .
    ?sense dbnary:gloss ?meaningTr .
    FILTER (lang(?meaningTr) = "tr")
  }
}
LIMIT ${limit} OFFSET ${offset}
`;

async function fetchBatch(offset, limit = 1000) {
  const params = new URLSearchParams({
    query: buildQuery(offset, limit),
    format: 'json',
  });
  const response = await fetch(`${SPARQL_ENDPOINT}?${params.toString()}`, {
    headers: { 'Accept': 'application/sparql-results+json' },
  });
  if (!response.ok) {
    throw new Error(`SPARQL request failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data.results.bindings;
}

async function main() {
  const allWords = [];
  let offset = 0;
  const limit = 1000;
  let batch;

  console.log('Starting fetch from DBnary...');
  do {
    console.log(`Fetching offset ${offset}...`);
    batch = await fetchBatch(offset, limit);
    batch.forEach((binding) => {
      allWords.push({
        word_ar: binding.word?.value || null,
        plural_ar: binding.plural?.value || null,
        antonym_ar: binding.antonym?.value || null,
        meaning_en: binding.meaningEn?.value || null,
        meaning_tr: binding.meaningTr?.value || null,
      });
    });
    offset += limit;
  } while (batch.length === limit);

  const dir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allWords, null, 2), 'utf8');
  console.log(`Done! Saved ${allWords.length} words to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});