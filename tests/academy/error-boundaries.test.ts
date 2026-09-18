/**
 * Every page has a way back when it fails.
 *
 * The launch E2E audit (2026-09-18) found no error.tsx and no
 * global-error.tsx anywhere under src/app: an unexpected failure showed Next's
 * bare "Application error" screen, in English, with no retry and no link
 * home. These are the static invariants of the two boundaries.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PUBLIC_MESSAGES } from "../../src/lib/academy/public/messages.ts";

const ROOT = path.join(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
/** Source with comments removed, so a comment that mentions a pattern cannot satisfy or break an assertion. */
const code = (rel: string) => read(rel).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

describe("the page error boundary", () => {
  const src = code("src/app/error.tsx");

  test("is a client component that offers retry and a way home", () => {
    assert.match(src, /^"use client";/);
    assert.match(src, /export default function ErrorPage\(\{ error, retry \}/);
    assert.match(src, /onClick=\{\(\) => retry\(\)\}/);
    assert.match(src, /<Link href="\/"/);
  });

  test("stays inside the root layout and shows no error details", () => {
    assert.doesNotMatch(src, /<html|<body/);
    assert.doesNotMatch(src, /error\.message|error\.stack/);
  });

  test("speaks the reader's language", () => {
    assert.match(src, /PUBLIC_MESSAGES\[resolveLocale\(/);
    for (const key of ["errorTitle", "errorBody", "tryAgain", "backToHome"]) assert.match(src, new RegExp(`t\\.${key}`));
  });
});

describe("the root layout error boundary", () => {
  const src = code("src/app/global-error.tsx");

  test("renders its own labelled document", () => {
    assert.match(src, /^"use client";/);
    assert.match(src, /<html lang=\{locale\} dir=\{localeDirection\(locale\)\}>/);
    assert.match(src, /<body>/);
    assert.match(src, /onClick=\{\(\) => retry\(\)\}/);
    assert.doesNotMatch(src, /error\.message|error\.stack/);
  });

  test("reads the same locale cookie as the root layout", () => {
    assert.match(src, /LOCALE_COOKIE/);
    assert.match(src, /resolveLocale\(/);
  });
});

test("error strings exist in every locale", () => {
  for (const locale of ["en", "ar", "tr"] as const) {
    for (const key of ["errorTitle", "errorBody", "tryAgain"] as const) {
      assert.ok(PUBLIC_MESSAGES[locale][key].length > 0, `${locale}.${key}`);
    }
  }
  assert.ok(existsSync(path.join(ROOT, "src/app/not-found.tsx")));
});
