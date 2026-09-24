/**
 * The homepage's V10 content keys exist, non-empty, in all three message files.
 *
 * The <T> mechanism renders the raw key when a locale lacks it (and English
 * renders whatever en.json holds for a named key), so a missing entry is a
 * visitor-facing defect, not a silent fallback. This test walks src/app/page.tsx
 * for every named home.* key it actually renders, then asserts each one — plus
 * the sentence keys the page kept — resolves to a non-empty string in en, ar
 * and tr. It also guards that no locale file lost the keys the page relies on.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const home = read("src/app/page.tsx");
const locales = ["en", "ar", "tr"] as const;
const messages: Record<string, Record<string, unknown>> = Object.fromEntries(
  locales.map((l) => [l, JSON.parse(read(`src/messages/${l}.json`))]),
);

/** Every named key the homepage renders through <T>, straight from the source. */
const namedKeys = [...new Set([...home.matchAll(/"(home\.[a-z0-9.]+[a-zA-Z0-9])"/gi)].map((m) => m[1]))]
  .concat([...new Set([...home.matchAll(/<T>(home\.[^<]+)<\/T>/g)].map((m) => m[1]))]);

/** Sentence keys the page still renders and every locale must translate. */
const sentenceKeys = [
  "Founder: Dr. Jehan Ali Ziad",
  "The Academy",
  "Three pillars of mastery",
  "Curriculum",
  "Mentorship",
  "Certification",
  "A1 — C2 Curriculum",
  "Read",
  "The first command",
  "Academy courses",
  "Part of",
  "View course",
  "No courses are open yet. Please check back soon.",
  "View all courses",
  "Your Path to Certification",
  "Explore certification",
];

describe("homepage i18n parity across en, ar and tr", () => {
  test("the page renders at least the expected number of named home.* keys", () => {
    assert.ok(namedKeys.length >= 40, `found ${namedKeys.length} named keys in page.tsx`);
  });

  for (const locale of locales) {
    test(`${locale}: every named home.* key resolves to a non-empty string`, () => {
      const missing = namedKeys.filter((k) => {
        const v = messages[locale][k];
        return typeof v !== "string" || v === "";
      });
      assert.deepEqual(missing, []);
    });

    test(`${locale}: every kept sentence key resolves to a non-empty string`, () => {
      const missing = sentenceKeys.filter((k) => {
        const v = messages[locale][k];
        return typeof v !== "string" || v === "";
      });
      assert.deepEqual(missing, []);
    });
  }

  test("no named key leaks a raw key as its English copy", () => {
    for (const k of namedKeys) {
      assert.notEqual(messages.en[k], k, `en.json must carry real copy for ${k}`);
    }
  });

  test("the split hero title keeps its joining whitespace in every locale", () => {
    // The h1 renders h1a + <em>h1b</em> + h1c as three adjacent strings; the
    // spaces live INSIDE the values (trailing in h1a, leading in h1c), so an
    // innocent trim() in a translation file would glue words together on screen.
    for (const locale of locales) {
      const h1a = messages[locale]["home.hero.h1a"] as string;
      const h1c = messages[locale]["home.hero.h1c"] as string;
      assert.match(h1a, /\s$/, `${locale}: home.hero.h1a must end with a space`);
      assert.match(h1c, /^\s/, `${locale}: home.hero.h1c must start with a space`);
    }
  });

  test("the three statements live inside the hero card, not as separate cards", () => {
    // The rows render inside the card container that also holds the glyph.
    const card = home.slice(home.indexOf("ٱقْرَأْ"), home.indexOf("ٱقْرَأْ") + 3000);
    for (const k of ["home.card.row1", "home.card.row2", "A1 — C2 Curriculum"]) {
      assert.ok(card.includes(k), `${k} inside the اقرأ card`);
    }
  });
});
