/**
 * Phase 3 batch 5 — evaluation fallback memory safety.
 * Behavioural: exact distances, symmetry, and equivalence against a
 * test-local full-matrix reference (the algorithm the evaluators used to
 * carry). Static: no full n×m matrix may return to the helper or evaluators.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { levenshteinDistance } from "../../src/lib/ai/levenshtein.ts";

const SRC = join(import.meta.dirname, "..", "..", "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const code = (rel: string) => read(rel).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

/** The previous production implementation, kept here only as an oracle for small inputs. */
function referenceFullMatrix(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

/** Deterministic PRNG so the comparison corpus is reproducible. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000;
}

describe("exact distances", () => {
  test("empty and trivial cases", () => {
    assert.equal(levenshteinDistance("", ""), 0);
    assert.equal(levenshteinDistance("", "abc"), 3);
    assert.equal(levenshteinDistance("abc", ""), 3);
    assert.equal(levenshteinDistance("abc", "abc"), 0);
    assert.equal(levenshteinDistance("السلام عليكم", "السلام عليكم"), 0);
  });
  test("classic and single-edit cases", () => {
    assert.equal(levenshteinDistance("kitten", "sitting"), 3);
    assert.equal(levenshteinDistance("flaw", "lawn"), 2);
    assert.equal(levenshteinDistance("abc", "abcd"), 1, "one insertion");
    assert.equal(levenshteinDistance("abcd", "abc"), 1, "one deletion");
    assert.equal(levenshteinDistance("abc", "abd"), 1, "one replacement");
    assert.equal(levenshteinDistance("abc", "xyz"), 3, "completely different");
    assert.equal(levenshteinDistance("ثلاثة", "سلاسة"), 2, "two Arabic substitutions");
  });
  test("symmetry", () => {
    for (const [a, b] of [["kitten", "sitting"], ["", "abc"], ["مرحبا", "مرحبًا"], ["a".repeat(50), "b".repeat(20)]]) {
      assert.equal(levenshteinDistance(a, b), levenshteinDistance(b, a));
    }
  });
  test("UTF-16 code-unit semantics match the old implementation (surrogate pairs count as two units)", () => {
    assert.equal(levenshteinDistance("😀", ""), 2);
    assert.equal(levenshteinDistance("😀", "😁"), referenceFullMatrix("😀", "😁"));
    assert.equal(levenshteinDistance("é", "é"), referenceFullMatrix("é", "é"));
  });
});

describe("equivalence with the previous full-matrix algorithm", () => {
  test("random corpus over a small alphabet, mixed lengths", () => {
    const rand = lcg(20260913);
    const alphabet = "abcده ";
    const make = (max: number) => {
      const len = Math.floor(rand() * (max + 1));
      let s = "";
      for (let i = 0; i < len; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
      return s;
    };
    for (let i = 0; i < 400; i++) {
      const a = make(30);
      const b = make(30);
      assert.equal(levenshteinDistance(a, b), referenceFullMatrix(a, b), `mismatch for ${JSON.stringify([a, b])}`);
    }
  });
  test("representative evaluation samples", () => {
    const samples: Array<[string, string]> = [
      ["اكتب جملة عن الطقس", "اكتب جمله عن الطقس"],
      ["The letter ث is pronounced with the tongue between the teeth", "the letter s is pronounced with the tongue between the teeth"],
      ["أنا أذهب إلى المدرسة كل يوم", "انا اذهب الى المدرسه كل يوم"],
      ["prompt", "a much longer answer that shares almost nothing with the prompt text"],
    ];
    for (const [a, b] of samples) assert.equal(levenshteinDistance(a, b), referenceFullMatrix(a, b));
  });
});

describe("memory shape", () => {
  test("handles the batch-5 worst case (2,000 x 5,000) without a matrix", () => {
    const a = "ا".repeat(2000);
    const b = "ب".repeat(4999) + "ا";
    // 2,000 x 5,000 cells of work; if a full matrix were allocated this would be ~10M numbers.
    const before = process.memoryUsage().heapUsed;
    const d = levenshteinDistance(a, b);
    const grew = process.memoryUsage().heapUsed - before;
    // 1,999 substitutions (ا -> ب) + 3,000 insertions; the trailing ا matches.
    assert.equal(d, 4999);
    assert.ok(grew < 8 * 1024 * 1024, `heap grew by ${grew} bytes; a full matrix would be tens of MB`);
  });
  test("helper allocates two rows sized by the shorter input only", () => {
    const src = code("lib/ai/levenshtein.ts");
    assert.equal(/number\[\]\[\]/.test(src), false, "no matrix type");
    assert.equal(/matrix\[/.test(src), false, "no matrix indexing");
    assert.equal(/Array\.from\(\{ length[^}]*\}, \(\) => /.test(src), false, "no nested array construction");
    assert.equal(/\[\s*i\s*\]\s*=\s*\[/.test(src), false, "no row-per-index allocation");
    assert.ok(src.includes("new Array<number>(n + 1)"), "rows sized by the shorter string");
    assert.ok(src.includes("if (row.length > col.length)"), "shorter string chosen as the row");
    assert.equal((src.match(/new Array<number>\(n \+ 1\)/g) ?? []).length, 2, "exactly two rows");
  });
  test("evaluators import the shared helper and no longer carry a private matrix copy", () => {
    for (const rel of ["lib/ai/evaluate-writing.ts", "lib/ai/evaluate-speaking.ts"]) {
      const src = code(rel);
      assert.ok(src.includes('import { levenshteinDistance } from "./levenshtein"'), `${rel} imports the helper`);
      assert.equal(/function levenshteinDistance\(/.test(src), false, `${rel} has no private copy`);
      assert.equal(/number\[\]\[\]|matrix\[/.test(src), false, `${rel} has no matrix`);
      assert.ok(src.includes("levenshteinDistance("), `${rel} still uses the fallback`);
    }
    // Scoring formulas untouched.
    assert.ok(code("lib/ai/evaluate-writing.ts").includes("(1 - distance / maxLength) * 100"));
    assert.ok(code("lib/ai/evaluate-speaking.ts").includes("100 - distance * 5"));
  });
});
