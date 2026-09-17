/**
 * Teacher signup must render the same text on the server and in the browser.
 *
 * A real signup attempt reported React error #418 — a text hydration
 * mismatch. The country and language <option> labels were resolved with
 * Intl.DisplayNames, which answers from whatever locale database the engine
 * was built with, so Node (server render) and Chrome (hydration) disagreed:
 * "Palestinian Territories" vs "Palestine", "Hong Kong SAR China" vs
 * "Hong Kong". Worse, Chrome had no name for 47 of the languages and returned
 * the bare code ("aa" for Afar), which also re-sorted the list — 121 of 178
 * options landed in a different position.
 *
 * The labels now come from the lists this repository authors, ordered by a
 * fixed key. These tests keep the engine's locale database out of the render
 * path and keep the authored data usable as labels.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ALL_COUNTRIES } from "../../src/lib/constants/countries.ts";
import { ALL_LANGUAGES } from "../../src/lib/constants/languages.ts";

const SRC = path.join(import.meta.dirname, "..", "..", "src");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const code = (rel: string) =>
  read(rel).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const FORM = "components/academy/workspace/teacher/application-form.tsx";
/** Everything that renders during the teacher signup, server and client alike. */
const RENDER_PATH = [
  "app/signup/teacher/page.tsx",
  "app/signup/teacher/layout.tsx",
  FORM,
  "components/academy/workspace/context.tsx",
  "components/academy/workspace/ui.tsx",
];

/** The ordering the form applies; recomputed here so the expected order is independent of it. */
const sortKey = (name: string) => name.normalize("NFD").replace(/[^A-Za-z]/g, "").toLowerCase();

// ---------------------------------------------------------------------------
// The engine's locale database stays out of the render
// ---------------------------------------------------------------------------
describe("option labels do not depend on the runtime's locale data", () => {
  test("the form never calls Intl or localeCompare", () => {
    const form = code(FORM);
    assert.doesNotMatch(form, /Intl\./, "Intl answers differently in Node and in the browser");
    assert.doesNotMatch(form, /localeCompare/, "collation is the engine's to choose, so it cannot order rendered text");
  });

  test("the lists are built once at module scope, not per render or per locale", () => {
    const form = code(FORM);
    const component = form.indexOf("export function ApplicationForm");
    assert.ok(component > 0, "the form component must stay exported from this file");
    for (const name of ["COUNTRY_OPTIONS", "LANGUAGE_OPTIONS"]) {
      const declared = form.indexOf(`const ${name} =`);
      assert.ok(declared > 0, `${name} must be declared`);
      assert.ok(declared < component, `${name} must be a module constant, so every render and both runtimes share it`);
    }
    // The selects render those constants directly.
    assert.match(form, /\{COUNTRY_OPTIONS\.map\(/);
    assert.match(form, /\{LANGUAGE_OPTIONS\.map\(/);
    assert.equal(form.includes("ALL_COUNTRIES.map("), false, "the authored list is ordered once, not mapped in the JSX");
  });

  test("nothing in the signup render path reads a browser-only or clock-dependent value", () => {
    // Any of these differ between the server render and the first client render.
    const forbidden = [
      /\bDate\.now\(/,
      /\bnew Date\(\s*\)/,
      /\bMath\.random\(/,
      /\brandomUUID\(/,
      /\blocalStorage\b/,
      /\bsessionStorage\b/,
      /\bnavigator\./,
      /\bwindow\./,
      /\bdocument\./,
    ];
    for (const rel of RENDER_PATH) {
      const source = code(rel);
      for (const pattern of forbidden) {
        assert.doesNotMatch(source, pattern, `${rel} must not render from ${pattern.source}`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The authored lists have to be usable as labels
// ---------------------------------------------------------------------------
describe("the authored country and language lists", () => {
  test("every entry has a unique code and a real name", () => {
    for (const [label, list] of [["country", ALL_COUNTRIES], ["language", ALL_LANGUAGES]] as const) {
      assert.ok(list.length > 100, `${label} list looks truncated (${list.length})`);
      const codes = new Set(list.map((entry) => entry.code));
      assert.equal(codes.size, list.length, `${label} codes must be unique`);
      for (const entry of list) {
        assert.ok(entry.name.trim().length > 1, `${label} ${entry.code} has no name`);
        // The symptom Chrome showed: a code standing in for a name.
        assert.notEqual(entry.name.toLowerCase(), entry.code.toLowerCase(), `${label} ${entry.code} is labelled with its own code`);
        assert.doesNotMatch(entry.name, /^[a-z]{2,3}$/, `${label} ${entry.code} is labelled with a bare code`);
        assert.ok(sortKey(entry.name).length > 0, `${label} ${entry.code} has no sortable letters`);
      }
    }
  });

  test("sorting by the fixed key puts both lists in alphabetical order", () => {
    for (const [label, list] of [["country", ALL_COUNTRIES], ["language", ALL_LANGUAGES]] as const) {
      const sorted = [...list].sort((a, b) => (sortKey(a.name) < sortKey(b.name) ? -1 : sortKey(a.name) > sortKey(b.name) ? 1 : 0));
      for (let i = 1; i < sorted.length; i++) {
        assert.ok(sortKey(sorted[i - 1]!.name) <= sortKey(sorted[i]!.name), `${label} order breaks at ${sorted[i]!.name}`);
      }
      // A total order: no two entries collapse to the same key, so the sort cannot depend on
      // the engine's sort stability either.
      assert.equal(new Set(sorted.map((entry) => sortKey(entry.name))).size, sorted.length, `${label} names must sort unambiguously`);
    }
  });

  test("the countries the two engines disagreed about keep their authored name", () => {
    const named = new Map(ALL_COUNTRIES.map((entry) => [entry.code, entry.name]));
    for (const codeName of ["PS", "HK", "MO", "FK"]) {
      const name = named.get(codeName);
      assert.ok(name && name.length > 2, `${codeName} must have an authored name`);
    }
  });
});
