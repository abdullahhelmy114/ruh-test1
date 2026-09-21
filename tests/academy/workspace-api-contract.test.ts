/**
 * The academy screens and the routes they call, checked against the files
 * that serve them:
 *
 *   - every learner, teacher and administrator API path resolves to a route
 *     file under src/app/api (dynamic segments resolved as the App Router does);
 *   - every write a screen sends (path, "METHOD") is exported by that route;
 *   - every read (useApi) has a GET;
 *   - the shared command components (ReasonCommand, StateChange) use methods
 *     their routes export.
 *
 * A renamed route, a removed handler or a screen calling a method the server
 * does not serve fails here instead of in the browser.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { adminApi } from "../../src/components/academy/workspace/admin/api-paths.ts";
import { api } from "../../src/components/academy/workspace/paths.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const APP = join(ROOT, "src", "app");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function routeFileFor(url: string): string | null {
  let dir = APP;
  const segments = new URL(url, "http://localhost").pathname.split("/").filter(Boolean);
  for (const segment of segments) {
    const literal = join(dir, segment);
    if (existsSync(literal) && statSync(literal).isDirectory()) {
      dir = literal;
      continue;
    }
    const entries = readdirSync(dir);
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

const methodsOf = (file: string) => [...readFileSync(file, "utf8").matchAll(/^export const (GET|POST|PUT|PATCH|DELETE) = /gm)].map((m) => m[1]);

type PathTable = Record<string, string | ((...args: never[]) => string)>;

/** A concrete URL for a path entry, with placeholder ids. */
function urlOf(table: PathTable, key: string): string {
  const entry = table[key];
  if (typeof entry === "string") return entry;
  const args = Array.from({ length: Math.max(entry.length, 1) }, (_, i) => `id${i + 1}`);
  return (entry as (...values: string[]) => string)(...args);
}

const TABLES: Record<"api" | "adminApi", PathTable> = { api: api as unknown as PathTable, adminApi: adminApi as unknown as PathTable };

const screenFiles = [
  ...walk(join(APP, "academy", "(workspace)")),
  ...walk(join(ROOT, "src", "components", "academy", "workspace")),
].filter((path) => /\.tsx?$/.test(path) && !/paths\.ts$/.test(path));

/** The text of a call's argument list starting at `open` (the index of its "("). */
function argumentsAt(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")" && --depth === 0) return src.slice(open + 1, i);
  }
  return src.slice(open + 1);
}

const REF = /\b(api|adminApi)\.(\w+)/g;

describe("academy screens ↔ routes", () => {
  test("every API path the screens can build is served by a route file", () => {
    let count = 0;
    for (const [name, table] of Object.entries(TABLES)) {
      for (const key of Object.keys(table)) {
        if (name === "adminApi" && key === "people") continue; // the legacy administrator people directory, checked below
        const url = urlOf(table, key);
        assert.ok(routeFileFor(url), `${name}.${key} → ${url} has no route`);
        count++;
      }
    }
    assert.ok(count >= 90, `only ${count} paths checked`);
    assert.ok(routeFileFor(adminApi.people), "the people directory route exists");
    assert.ok(methodsOf(routeFileFor(adminApi.people) as string).includes("GET"));
  });

  test("every write a screen sends uses a method its route exports", () => {
    const writes: string[] = [];
    for (const file of screenFiles) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/\b(api|adminApi)\.(\w+)(\((?:[^()]|\([^()]*\))*\))?\s*,\s*"(GET|POST|PUT|PATCH|DELETE)"/g)) {
        writes.push(`${m[1]}.${m[2]} ${m[4]}`);
        const route = routeFileFor(urlOf(TABLES[m[1] as "api" | "adminApi"], m[2]));
        assert.ok(route, `${relative(ROOT, file)}: ${m[1]}.${m[2]} has no route`);
        assert.ok(methodsOf(route).includes(m[4]), `${relative(ROOT, file)}: ${m[1]}.${m[2]} is sent ${m[4]}, but ${relative(ROOT, route)} exports ${methodsOf(route).join(", ")}`);
      }
      for (const m of src.matchAll(/requestJson\((api|adminApi)\.(\w+)(\((?:[^()]|\([^()]*\))*\))?\s*,\s*\{\s*method:\s*"(\w+)"/g)) {
        writes.push(`${m[1]}.${m[2]} ${m[4]}`);
        const route = routeFileFor(urlOf(TABLES[m[1] as "api" | "adminApi"], m[2])) as string;
        assert.ok(methodsOf(route).includes(m[4]), `${relative(ROOT, file)}: ${m[1]}.${m[2]} ${m[4]}`);
      }
    }
    assert.ok(writes.length >= 50, `only ${writes.length} writes found; the scan may have stopped matching`);
  });

  test("every read has a GET", () => {
    let reads = 0;
    for (const file of screenFiles) {
      const src = readFileSync(file, "utf8");
      for (const call of src.matchAll(/\buseApi(?:<[^(]*?>)?\(/g)) {
        const args = argumentsAt(src, (call.index ?? 0) + call[0].length - 1);
        for (const ref of args.matchAll(REF)) {
          reads++;
          const route = routeFileFor(urlOf(TABLES[ref[1] as "api" | "adminApi"], ref[2]));
          assert.ok(route && methodsOf(route).includes("GET"), `${relative(ROOT, file)} reads ${ref[1]}.${ref[2]} without a GET route`);
        }
      }
    }
    assert.ok(reads >= 60, `only ${reads} reads found`);
  });

  test("shared command components use methods their routes export", () => {
    let commands = 0;
    for (const file of screenFiles) {
      const src = readFileSync(file, "utf8");
      for (const element of src.matchAll(/<(ReasonCommand|StateChange)\b[\s\S]*?\/>/g)) {
        const url = /url=\{(api|adminApi)\.(\w+)/.exec(element[0]);
        if (!url) continue;
        commands++;
        const method = element[1] === "StateChange" ? "PATCH" : (/method="(\w+)"/.exec(element[0])?.[1] ?? "PATCH");
        const route = routeFileFor(urlOf(TABLES[url[1] as "api" | "adminApi"], url[2]));
        assert.ok(route && methodsOf(route).includes(method), `${relative(ROOT, file)}: <${element[1]} url=${url[1]}.${url[2]}> sends ${method}`);
      }
    }
    assert.ok(commands >= 15, `only ${commands} commands found`);
    const kit = readFileSync(join(ROOT, "src", "components", "academy", "workspace", "admin", "kit.tsx"), "utf8");
    assert.match(kit, /action\.run\(url, "PATCH", \{ action: command, to,/, "StateChange always sends PATCH");
    assert.match(kit, /method = "PATCH",/, "ReasonCommand defaults to PATCH");
  });
});

describe("teacher screens", () => {
  test("the legacy teacher dashboard is retired: every screen redirects to /dashboard and calls nothing", () => {
    const legacy = walk(join(APP, "dashboard", "teacher"));
    assert.ok(legacy.length >= 11);
    for (const file of legacy) {
      assert.ok(file.endsWith("page.tsx"), `${relative(ROOT, file)} remains beside the retired screens`);
      const src = readFileSync(file, "utf8");
      const code = src.replace(/^\s*\/\/.*$/gm, "");
      assert.match(src, /^import \{ redirect \} from "next\/navigation";/, relative(ROOT, file));
      assert.match(code, /export default function \w+\(\) \{\s*redirect\("\/dashboard"\);\s*\}/, relative(ROOT, file));
      assert.doesNotMatch(code, /fetch\(|\/api\/|"use client"/, relative(ROOT, file));
    }
  });

  test("nothing links to the legacy teacher dashboard or keeps the role in browser storage", () => {
    for (const file of walk(join(ROOT, "src")).filter((path) => /\.(ts|tsx)$/.test(path))) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /\/dashboard\/teacher\b/, relative(ROOT, file));
      assert.doesNotMatch(src, /localStorage\.(getItem|setItem)\(["']userRole["']/, relative(ROOT, file));
    }
  });

  test("email verification sends the account to the home the server names, by role and status", () => {
    const route = readFileSync(join(APP, "api", "verify-email-code", "route.ts"), "utf8");
    assert.match(route, /SELECT vc\.email_code, p\.firebase_uid, p\.role, p\.status/);
    assert.match(route, /const home = accountHome\(role, role === 'student' \? ACTIVE_ACCOUNT_STATUS : status\);\s*return NextResponse\.json\(\{ success: true, role, home \}\);/);
    const page = readFileSync(join(APP, "verify-email", "page.tsx"), "utf8");
    assert.match(page, /const home = localHome\(data\.home, "\/dashboard"\);/);
    // Sign-up runs on the server, so a just-verified browser usually holds no session: it is sent
    // to sign in rather than into the workspace, which would answer the success with an error.
    assert.ok(page.includes('router.push(user ? home : "/login");'), 'a browser with no session is sent to sign in');
  });

  test("an applicant opening any other workspace screen is taken to the application page", () => {
    const shell = readFileSync(join(ROOT, "src", "components", "academy", "workspace", "shell.tsx"), "utf8");
    assert.match(shell, /const applicant = role === "teacher" && status !== "active";/);
    assert.match(shell, /const elsewhere = applicant && !isLoading && pathname !== pages\.teacherApplication;/);
    assert.match(shell, /if \(elsewhere\) router\.replace\(pages\.teacherApplication\);/);
    assert.match(shell, /\{elsewhere \? null : children\}/, "the refused screen is not rendered meanwhile");
  });
});
