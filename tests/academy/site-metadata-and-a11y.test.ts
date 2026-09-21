/**
 * What the root layout tells search engines, and what it gives a keyboard.
 *
 * Three defects, all in one file:
 *  - hreflang alternates advertised https://ruhulqudus.com/en, /ar and /tr as this site's
 *    translations. Those routes do not exist: the language is chosen by a cookie, not by a path,
 *    so the site was pointing crawlers at three 404s;
 *  - a site-wide canonical pointed every page that does not set its own metadata at the homepage,
 *    which asks search engines to treat all of them as duplicates of it;
 *  - there was no skip link, so a keyboard or screen-reader visitor walked the whole header before
 *    reaching the content, on every page.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const code = (rel: string) => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const layout = code("src/app/layout.tsx");

describe("the site advertises only addresses that exist", () => {
  test("no hreflang alternate points at a locale path, because none exists", () => {
    assert.doesNotMatch(layout, /languages:\s*\{/, "the language is a cookie, not a path");
    for (const locale of ["en", "ar", "tr"]) {
      assert.equal(existsSync(join(ROOT, "src", "app", locale)), false, `/${locale} must not exist`);
      assert.doesNotMatch(layout, new RegExp(`ruhulqudus\\.com/${locale}"`), `/${locale} must not be advertised`);
    }
  });

  test("the root layout sets no canonical that every page would inherit", () => {
    assert.doesNotMatch(layout, /canonical:/, "a page that needs a canonical sets its own");
  });

  test("the pages that do set a canonical still do", () => {
    // Removing the inherited one must not remove the ones pages set for themselves.
    for (const page of ["src/app/about/page.tsx", "src/app/contact/page.tsx", "src/app/certification/page.tsx", "src/app/privacy/page.tsx"]) {
      assert.match(read(page), /canonical:/, page);
    }
  });
});

describe("a keyboard reaches the content without walking the header", () => {
  test("a skip link is the first thing in the page and targets the main region", () => {
    const skip = layout.indexOf('href="#main-content"');
    const navbar = layout.indexOf("<Navbar />");
    assert.ok(skip !== -1, "there must be a skip link");
    assert.ok(skip < navbar, "it must come before the header");
    assert.match(layout, /<main id="main-content" tabIndex=\{-1\}/, "the target must be focusable");
  });

  test("it is hidden until focused, then visible", () => {
    assert.match(layout, /className="sr-only focus:not-sr-only/);
    assert.match(layout, /focus:ring-2/, "it must show a focus ring when it appears");
  });

  test("its label is translated, not hardcoded English", () => {
    assert.match(layout, /<T>Skip to content<\/T>/);
    for (const locale of ["en", "ar", "tr"]) {
      const messages = JSON.parse(read(`src/messages/${locale}.json`)) as Record<string, unknown>;
      assert.equal(typeof messages["Skip to content"], "string", `${locale} is missing the label`);
    }
  });
});
