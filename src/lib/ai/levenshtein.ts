// src/lib/ai/levenshtein.ts
// مسافة ليفنشتاين (احتياطي التقييم عند تعذّر تحليل رد النموذج)
//
// Phase 3 batch 5 — memory-safety correction. Both evaluators used to carry a
// private copy that allocated a full (|b|+1) x (|a|+1) matrix: O(n*m) resident
// memory per fallback (up to ~10 million cells under the batch-5 caps), and
// concurrent evaluations multiplied that. This rolling two-row version
// returns the identical edit distance with O(min(n, m)) working memory.
//
// Semantics are unchanged: unit-cost insert/delete/substitute over UTF-16
// code units (the previous implementation compared `charAt` results), so
// surrogate pairs and combining marks count exactly as before.

/**
 * Standard Levenshtein edit distance between two strings.
 * Time O(n*m); space O(min(n, m)) — never a full matrix.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Keep the shorter string as the row so the two rows are as small as possible.
  let row = a;
  let col = b;
  if (row.length > col.length) {
    row = b;
    col = a;
  }
  const n = row.length;

  let previous = new Array<number>(n + 1);
  let current = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) previous[j] = j;

  for (let i = 1; i <= col.length; i++) {
    current[0] = i;
    const cc = col.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = row.charCodeAt(j - 1) === cc ? 0 : 1;
      const substitute = previous[j - 1] + cost;
      const insert = current[j - 1] + 1;
      const remove = previous[j] + 1;
      current[j] = substitute < insert ? (substitute < remove ? substitute : remove) : (insert < remove ? insert : remove);
    }
    const swap = previous;
    previous = current;
    current = swap;
  }

  return previous[n];
}
