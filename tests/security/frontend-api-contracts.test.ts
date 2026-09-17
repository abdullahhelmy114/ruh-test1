/**
 * Every API call written as fetch("/api/...") or authFetch("/api/...") in the
 * application's screens and components reaches a route that exists and serves
 * the HTTP method the call uses.
 *
 * A full map of the screens (run during the consolidation pass) found calls to
 * routes that never existed or no longer accepted the method: the legacy
 * library administration (book list, categories, overlays, cover files), model
 * lesson deletion, lesson quizzes, user suspension and deletion, AI generation
 * and speech, library categories, practice prompts and two page-content
 * endpoints. Several screens also changed their lists as if those calls had
 * succeeded. The academy workspace's own path tables are checked separately in
 * tests/academy/workspace-api-contract.test.ts.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const SRC = join(ROOT, "src");
const APP = join(SRC, "app");
const API = join(APP, "api");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** The route file serving a URL path, resolving dynamic and catch-all segments as the App Router does. */
function routeFileFor(path: string): string | null {
  const segments = path.split("?")[0].split("/").filter(Boolean);
  let dir = APP;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const entries = readdirSync(dir);
    if (segment !== "${}" && entries.includes(segment) && statSync(join(dir, segment)).isDirectory()) {
      dir = join(dir, segment);
      continue;
    }
    const dynamic = entries.find((entry) => /^\[[^.\]]+\]$/.test(entry));
    if (dynamic) {
      dir = join(dir, dynamic);
      continue;
    }
    const catchAll = entries.find((entry) => /^\[\.\.\.[^\]]+\]$/.test(entry));
    if (!catchAll) return null;
    dir = join(dir, catchAll);
    break;
  }
  const file = join(dir, "route.ts");
  return existsSync(file) ? file : null;
}

function methodsOf(file: string): string[] {
  const src = readFileSync(file, "utf8");
  return ["GET", "POST", "PUT", "PATCH", "DELETE"].filter((method) => new RegExp(`export (?:const ${method}\\b|(?:async )?function ${method}\\b)`).test(src));
}

/** The object literal starting at `open` (a "{"), by brace matching. */
function objectAt(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  return src.slice(open);
}

interface Call {
  readonly file: string;
  readonly line: number;
  readonly path: string;
  readonly method: string | null;
}

function calls(): Call[] {
  const files = walk(SRC).filter((path) => /\.(ts|tsx)$/.test(path) && !path.startsWith(API));
  const found: Call[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/\b(?:fetch|authFetch)\(\s*([`"'])(\/api\/[^`"']*)\1\s*(\)|,\s*\{)/g)) {
      let path = m[2].replace(/\$\{[^}]*\}/g, "${}");
      if (path.endsWith("/")) path += "${}";
      let method: string | null = "GET";
      if (m[3] !== ")") {
        const options = objectAt(src, (m.index ?? 0) + m[0].length - 1);
        const literal = /\bmethod:\s*["'`](\w+)["'`]/.exec(options);
        method = literal ? literal[1].toUpperCase() : /\bmethod:/.test(options) ? null : "GET";
      }
      found.push({ file: relative(ROOT, file).replace(/\\/g, "/"), line: src.slice(0, m.index).split("\n").length, path, method });
    }
  }
  return found;
}

describe("screens call routes that exist", () => {
  const all = calls();

  test("the scan sees the application's calls", () => {
    assert.ok(all.length >= 120, `only ${all.length} calls found`);
  });

  test("every called API path is served by a route file", () => {
    const missing = all.filter((call) => routeFileFor(call.path) === null).map((call) => `${call.file}:${call.line} ${call.path}`);
    assert.deepEqual(missing, []);
  });

  test("every call uses a method its route exports", () => {
    const wrong = all
      .filter((call) => call.method !== null)
      .map((call) => ({ call, route: routeFileFor(call.path) }))
      .filter(({ call, route }) => route !== null && !methodsOf(route).includes(call.method as string))
      .map(({ call, route }) => `${call.file}:${call.line} ${call.method} ${call.path} (route exports ${methodsOf(route as string).join(", ")})`);
    assert.deepEqual(wrong, []);
  });
});

describe("screens repaired in this pass", () => {
  test("library administration uses the category, book and overlay routes that exist; covers without a URL show a placeholder", () => {
    const library = readFileSync(join(APP, "dashboard", "admin", "library", "page.tsx"), "utf8");
    assert.doesNotMatch(library, /\/api\/admin\/categories|\/api\/library\/files/);
    const editor = readFileSync(join(APP, "dashboard", "admin", "library", "editor", "[bookId]", "page.tsx"), "utf8");
    assert.doesNotMatch(editor, /\/api\/admin\/library\/(books|overlays)|\/api\/library\/files/);
    assert.match(editor, /content\.questions = \[\{ question: quizQuestion\.trim\(\), options, correctIndex \}\];/, "quizzes are saved in the shape the reader renders");
    const reader = readFileSync(join(SRC, "components", "reader", "PageOverlay.tsx"), "utf8");
    assert.match(reader, /content\?\.questions/);
    assert.match(reader, /q\.correctIndex/);
    const overlay = readFileSync(join(API, "library", "page-overlay", "[id]", "route.ts"), "utf8");
    assert.equal((overlay.match(/await requireAdmin\(req\);/g) ?? []).length, 2);
    const adminBooks = readFileSync(join(API, "admin", "library", "books", "route.ts"), "utf8");
    assert.match(adminBooks, /export const GET = withApi\(async \(request\) => \{\s*await requireAdmin\(request\);/);
    assert.match(adminBooks, /'Cache-Control': 'private, no-store'/);
    assert.doesNotMatch(readFileSync(join(APP, "library", "page.tsx"), "utf8"), /placeholder-cover\.png|\/api\/library\/(files|categories)/);
  });

  test("actions whose endpoints never existed no longer pretend to succeed", () => {
    const dashboard = readFileSync(join(APP, "dashboard", "admin", "page.tsx"), "utf8");
    assert.doesNotMatch(dashboard, /\/api\/admin\/quizzes|toggleBan|deleteUser\(|method: "PUT",[\s\S]{0,120}\/api\/admin\/users/);
    const lessons = readFileSync(join(APP, "dashboard", "admin", "model-course", "[id]", "lessons", "page.tsx"), "utf8");
    assert.match(lessons, /\/api\/admin\/model-course\/\$\{encodeURIComponent\(modelId\)\}\/lessons\/\$\{encodeURIComponent\(lessonId\)\}/);
    assert.match(lessons, /if \(!res\.ok\) \{\s*setError\("فشل حذف الدرس"\);\s*return;\s*\}\s*setLessons\(prev => prev\.filter/);
    for (const file of walk(SRC).filter((path) => /\.(ts|tsx)$/.test(path))) {
      const code = readFileSync(file, "utf8").replace(/^\s*\/\/.*$/gm, "");
      assert.doesNotMatch(code, /\/api\/ai\/(generate|tts)|\/api\/pages\/|\/api\/practice\//, relative(ROOT, file));
    }
    assert.equal(existsSync(join(SRC, "components", "reader", "FlipbookReader.tsx")), false, "the unused reader that called three missing routes is gone");
  });
});
