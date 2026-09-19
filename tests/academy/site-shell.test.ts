/**
 * The shared shell: the header that every page carries, and the document a
 * missing address returns.
 *
 * Browser validation on 2026-09-17 found two defects here. The header turned
 * on its desktop row at 768px although that row needs about 1100px, so from
 * 768px up to roughly 1100px controls were pushed off the left edge — present
 * in the markup, impossible to click. And the 404 page rendered its own <html>
 * and <body>, which put it outside the root layout: the document arrived with
 * no lang or dir and always in Arabic, whoever was reading.
 *
 * The widths and locales themselves are exercised in
 * tests/e2e/browser/responsive-shell.spec.mjs; these are the static
 * invariants that keep the fix from being undone by a one-word edit.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PUBLIC_MESSAGES } from "../../src/lib/academy/public/messages.ts";

const ROOT = path.join(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
/** Source with comments removed, so a comment that mentions a pattern cannot satisfy or break an assertion. */
const code = (rel: string) => read(rel).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const NAVBAR = "src/components/Navbar.tsx";
const NOT_FOUND_VIEW = "src/components/site/not-found-view.tsx";
const NOT_FOUND_FILES = ["src/app/not-found.tsx"];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
describe("the site header", () => {
  const navbar = code(NAVBAR);

  test("the desktop row and the compact row switch at the same width", () => {
    // Both halves of the switch must name one breakpoint: if they disagree there
    // is a range showing both rows or neither.
    const switches = [...navbar.matchAll(/\b(sm|md|lg|xl|2xl):(hidden|flex|block|grid|inline-flex)\b/g)];
    const breakpoints = [...new Set(switches.map((m) => m[1]))];
    assert.deepEqual(breakpoints, ["xl"], `the shell switches at one breakpoint, found ${breakpoints.join(", ")}`);
    assert.ok(switches.length >= 6, `expected the logo, nav, actions, menu button, compact row and drawer, found ${switches.length}`);
  });

  test("the desktop row appears only where it fits", () => {
    // Measured intrinsic width of that row is about 1100px (logo, six links,
    // the action controls), so md (768px) and lg (1024px) are both too narrow.
    assert.doesNotMatch(navbar, /\bmd:(hidden|flex|block)/, "md is narrower than the desktop row");
    assert.doesNotMatch(navbar, /\blg:(hidden|flex|block)/, "lg is narrower than the desktop row");
    assert.match(navbar, /<nav className="hidden xl:flex[^"]*">/);
    // And it can still give way rather than push its siblings off-screen.
    assert.match(navbar, /<nav className="hidden xl:flex min-w-0[^"]*overflow-x-auto">/);
  });

  test("the compact shell keeps every destination the desktop row has", () => {
    const menuButton = /aria-label=\{mobileOpen \? "Close menu" : "Open menu"\}/;
    assert.match(navbar, menuButton, "a labelled control opens the compact menu");
    // The same link list renders in both, so narrowing the window hides nothing.
    const listRenders = [...navbar.matchAll(/links\.map\(/g)].length;
    assert.ok(listRenders >= 2, `the primary links must render in both rows, found ${listRenders}`);
    // The legacy wishlist and cart are retired (their tables are outside the academy schema); see legacy-launch-path.test.ts.
    for (const destination of ["dashboardLink", "academyLink", "profileLink"]) {
      const uses = [...navbar.matchAll(new RegExp(destination.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))].length;
      assert.ok(uses >= 2, `${destination} must be reachable from both rows`);
    }
  });
});

// ---------------------------------------------------------------------------
// The 404 document
// ---------------------------------------------------------------------------
describe("a missing page", () => {
  const view = code(NOT_FOUND_VIEW);

  test("renders inside the root layout, so it inherits lang and dir", () => {
    for (const file of [NOT_FOUND_VIEW, ...NOT_FOUND_FILES]) {
      const src = code(file);
      assert.doesNotMatch(src, /<html/, `${file}: its own <html> would bypass the layout that sets lang and dir`);
      assert.doesNotMatch(src, /<body/, file);
    }
    // The root layout is the one place those attributes are decided.
    assert.match(code("src/app/layout.tsx"), /<html lang=\{locale\} dir=\{localeDirection\(locale\)\}/);
  });

  test("one not-found file serves every missing address", () => {
    // The root file is the boundary for unmatched addresses and for notFound()
    // calls anywhere in the app, so the copy cannot drift between them. (A
    // notFound() call is recovered by Next above the layout - see the note in
    // src/app/not-found.tsx - which no extra boundary file changes.)
    const extra = walk(path.join(ROOT, "src", "app"))
      .map((file) => path.relative(ROOT, file).replace(/\\/g, "/"))
      .filter((file) => file.endsWith("/not-found.tsx") && !NOT_FOUND_FILES.includes(file));
    assert.deepEqual(extra, [], "a second not-found file would split the 404 copy without changing the served document");
  });

  test("speaks the reader's language instead of one fixed language", () => {
    assert.match(view, /publicLocale\(\)/, "it reads the same preference cookie as every other page");
    assert.match(view, /t\.pageNotFoundTitle/);
    assert.match(view, /t\.pageNotFoundBody/);
    assert.match(view, /t\.backToHome/);
    // No copy baked into the component in any single language.
    assert.ok([...view].every((ch) => ch.codePointAt(0)! < 128), "copy in any script belongs in the message files, not the component");
    for (const locale of ["en", "ar", "tr"] as const) {
      for (const key of ["pageNotFoundTitle", "pageNotFoundBody", "backToHome"] as const) {
        assert.ok(PUBLIC_MESSAGES[locale][key].trim().length > 0, `${locale}.${key}`);
      }
    }
    // Three distinct languages, not the same string copied across.
    assert.equal(new Set(["en", "ar", "tr"].map((l) => PUBLIC_MESSAGES[l as "en"].pageNotFoundTitle)).size, 3);
  });

  test("no 404 is offered to search engines, and they all share one view", () => {
    for (const file of NOT_FOUND_FILES) {
      const src = code(file);
      assert.match(src, /robots:\s*\{\s*index:\s*false/, file);
      assert.match(src, /<NotFoundView \/>/, `${file}: one view, so the three cannot drift apart`);
    }
  });

  // The launch E2E audit (2026-09-18) found a missing program or course page
  // in the browser carrying "index, follow" before the not-found page's
  // "noindex": the route's own metadata fallback won. The fallbacks now say
  // noindex themselves.
  test("a missing program or course never asks to be indexed", () => {
    for (const file of ["src/app/academy/programs/[slug]/page.tsx", "src/app/academy/courses/[slug]/page.tsx"]) {
      const fallback = code(file).match(/return \{ title: "(Program|Course) \| Ruh-Ul-Qudus Academy"[^}]*\}[^}]*\}/)?.[0] ?? "";
      assert.match(fallback, /robots: \{ index: false, follow: false \}/, file);
    }
  });
});
