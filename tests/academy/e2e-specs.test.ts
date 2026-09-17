/**
 * Static guarantees for the end-to-end suites, so they cannot silently drift
 * from the application or become unsafe to run: every page a browser spec
 * opens exists, every spec is confined to the site under test, no
 * credentials or account data are written into the specs, and the suites
 * skip (rather than fail or reach out) when their environment is missing.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const E2E = join(ROOT, "tests", "e2e");
const APP = join(ROOT, "src", "app");
const specs = readdirSync(join(E2E, "browser")).filter((file) => file.endsWith(".spec.mjs"));
const read = (file: string) => readFileSync(join(E2E, "browser", file), "utf8");

/** Whether a URL path is served by a page, allowing dynamic segments and route groups. */
function pageExists(path: string): boolean {
  const segments = path.split("?")[0].split("/").filter(Boolean);
  const walk = (dir: string, rest: string[]): boolean => {
    if (!existsSync(dir)) return false;
    const entries = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const group of entries.filter((e) => /^\(.+\)$/.test(e.name))) {
      if (walk(join(dir, group.name), rest)) return true;
    }
    if (rest.length === 0) return existsSync(join(dir, "page.tsx"));
    const [head, ...tail] = rest;
    if (existsSync(join(dir, head)) && walk(join(dir, head), tail)) return true;
    return entries.filter((e) => /^\[[^.\]]+\]$/.test(e.name)).some((e) => walk(join(dir, e.name), tail));
  };
  return walk(APP, segments);
}

describe("end-to-end suites", () => {
  test("the browser specs and the HTTP smoke suite exist", () => {
    assert.deepEqual(specs.sort(), ["public-and-signed-out.spec.mjs", "signed-in-flows.spec.mjs"]);
    assert.ok(existsSync(join(E2E, "http-smoke.e2e.ts")));
    assert.ok(existsSync(join(E2E, "playwright.config.mjs")));
  });

  test("every page the specs open exists", () => {
    const paths = new Set<string>();
    for (const file of specs) {
      const src = read(file);
      for (const match of src.matchAll(/goto\(\s*[`"'](\/[^`"']*)[`"']/g)) paths.add(match[1].replace(/\$\{[^}]+\}/g, "x"));
      for (const match of src.matchAll(/"(\/academy[^"]*)"/g)) if (!match[1].startsWith("/api/")) paths.add(match[1]);
    }
    assert.ok(paths.size >= 12, `only ${paths.size} paths found`);
    const missing = [...paths].filter((path) => !pageExists(path));
    assert.deepEqual(missing, []);
    assert.equal(pageExists("/academy/does-not-exist-anywhere/x/y"), false, "the resolver rejects unknown paths");
  });

  test("specs run inside the fixture that blocks every other host", () => {
    const fixtures = readFileSync(join(E2E, "browser", "fixtures.mjs"), "utf8");
    assert.match(fixtures, /page\.route\("\*\*\/\*"/);
    assert.match(fixtures, /return route\.abort\(\);/);
    for (const file of specs) {
      const src = read(file);
      assert.match(src, /from "\.\/fixtures\.mjs"/, file);
      assert.doesNotMatch(src, /from "@playwright\/test"/, `${file} must use the confining fixture`);
    }
  });

  test("no credentials, account data or storage state are written into the suites", () => {
    for (const file of [...specs.map((s) => join(E2E, "browser", s)), join(E2E, "http-smoke.e2e.ts"), join(E2E, "playwright.config.mjs")]) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /password\s*[:=]\s*["'`]|apiKey|serviceAccount|BEGIN PRIVATE KEY/i, file);
      assert.doesNotMatch(src, /[A-Za-z0-9._%+-]+@(?!playwright\/)[A-Za-z0-9-]+\.[A-Za-z]{2,}/, `${file} contains an email address`);
      assert.doesNotMatch(src, /storageState:\s*["'`]/, `${file} hard-codes a storage state file`);
      assert.doesNotMatch(src, /eyJ[A-Za-z0-9_-]{10,}\./, `${file} contains a token`);
    }
  });

  test("suites skip when their environment is missing", () => {
    assert.match(readFileSync(join(E2E, "http-smoke.e2e.ts"), "utf8"), /const skip = BASE === "" \?/);
    const signedIn = read("signed-in-flows.spec.mjs");
    const tests = [...signedIn.matchAll(/\n  test\("/g)].length;
    const skips = [...signedIn.matchAll(/skipUnless\("E2E_(?:STUDENT|TEACHER|ADMIN|STUDENT_B|TEACHER_B|PENDING_TEACHER)_STATE"/g)].length;
    assert.ok(tests >= 9);
    assert.equal(skips, tests, "every signed-in test skips without its account state");
  });
});
