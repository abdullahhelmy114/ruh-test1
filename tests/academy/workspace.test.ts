/**
 * The academy workspace (learner, teacher and shared screens).
 *
 * The screens hold no authority: they read and write only through the
 * academy API, which enforces every access rule. These tests pin down what
 * the UI layer itself must guarantee: complete text in every locale, a
 * faithful reading of API failures, safe formatting, and static properties
 * of the screens (API-only data access, no browser storage, no raw HTML,
 * RTL-safe layout classes, labelled form controls, and notification links
 * that resolve to real pages).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { academyHome } from "../../src/components/academy/workspace/paths.ts";
import { PRODUCT_LOCALES } from "../../src/lib/academy/domain/vocabulary.ts";
import { dataOf, failureFromResponse } from "../../src/lib/academy/workspace/api-errors.ts";
import { displayName, fmt, formatDate } from "../../src/lib/academy/workspace/format.ts";
import { WORKSPACE_MESSAGES } from "../../src/lib/academy/workspace/messages.ts";

const ROOT = join(import.meta.dirname, "..", "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const rel = (path: string) => relative(ROOT, path).replace(/\\/g, "/");

type Tree = { readonly [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of leaves(value, path)) out.set(k, v);
  }
  return out;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("workspace text", () => {
  const reference = leaves(WORKSPACE_MESSAGES.en as unknown as Tree);

  test("every locale has exactly the English keys, no empty text and the same placeholders", () => {
    assert.ok(reference.size >= 300, `only ${reference.size} strings; the parity check would be weak`);
    for (const locale of PRODUCT_LOCALES) {
      const translated = leaves(WORKSPACE_MESSAGES[locale] as unknown as Tree);
      assert.deepEqual([...translated.keys()].sort(), [...reference.keys()].sort(), locale);
      for (const [key, text] of translated) {
        assert.ok(text.trim().length > 0, `${locale}.${key} is empty`);
        assert.deepEqual(placeholders(text), placeholders(reference.get(key) as string), `${locale}.${key} placeholders differ`);
      }
    }
  });

  test("Arabic and Turkish are actually translated, not copies of English", () => {
    for (const locale of ["ar", "tr"] as const) {
      const translated = leaves(WORKSPACE_MESSAGES[locale] as unknown as Tree);
      const same = [...translated].filter(([key, text]) => text === reference.get(key) && /[a-z]{4,}/i.test(text));
      assert.ok(same.length / translated.size < 0.02, `${locale}: ${same.length} strings are identical to English: ${same.slice(0, 5).map(([k]) => k).join(", ")}`);
    }
    assert.match(WORKSPACE_MESSAGES.ar.states.forbidden, /[؀-ۿ]/);
  });
});

describe("reading API failures", () => {
  test("statuses map to what the screen should say, keeping only server text meant for users", () => {
    assert.equal(failureFromResponse(401, { error: "Unauthorized", code: "UNAUTHORIZED" }).kind, "unauthenticated");
    assert.deepEqual(failureFromResponse(403, { error: "Forbidden", code: "FORBIDDEN" }), { kind: "forbidden", status: 403, message: null });
    // The academy's only other 403 is time-gated content (the Lesson Sheet release rule).
    assert.deepEqual(failureFromResponse(403, { error: "This Lesson Sheet is not available yet." }), { kind: "not_yet", status: 403, message: "This Lesson Sheet is not available yet." });
    assert.deepEqual(failureFromResponse(404, { error: "Lesson Sheet not found." }), { kind: "not_found", status: 404, message: null });
    assert.equal(failureFromResponse(409, { error: "This item was changed by someone else." }).message, "This item was changed by someone else.");
    assert.equal(failureFromResponse(400, { error: "A reason is required." }).kind, "invalid");
    assert.equal(failureFromResponse(429, { error: "Too many requests" }).kind, "rate_limited");
    assert.equal(failureFromResponse(503, { error: "This academy setting has not been configured yet." }).kind, "unavailable");
    assert.deepEqual(failureFromResponse(500, { error: "Internal server error" }), { kind: "server", status: 500, message: null });
    assert.deepEqual(failureFromResponse(502, "<html>"), { kind: "server", status: 502, message: null });
    assert.equal(failureFromResponse(409, { error: "x".repeat(600) }).message, null, "overlong server text is not shown");
  });

  test("successful responses must carry data", () => {
    assert.deepEqual(dataOf<{ a: number }>({ data: { a: 1 } }), { a: 1 });
    assert.throws(() => dataOf({ items: [] }));
    assert.throws(() => dataOf(null));
  });
});

describe("formatting", () => {
  test("placeholders are filled; unknown ones stay visible", () => {
    assert.equal(fmt("{attended} of {recorded}", { attended: 3, recorded: 4 }), "3 of 4");
    assert.equal(fmt("Opens {date}", {}), "Opens {date}");
  });

  test("plain calendar dates are never shifted by a time zone", () => {
    assert.match(formatDate("2026-10-01", "en"), /1 Oct 2026/);
    assert.equal(formatDate("not a date", "en"), "");
    assert.equal(formatDate(null, "tr"), "");
  });

  test("names fall back to a neutral label, never an identifier", () => {
    assert.equal(displayName("  ", "Name not set"), "Name not set");
    assert.equal(displayName(null, "Name not set"), "Name not set");
    assert.equal(displayName(" Amina ", "x"), "Amina");
  });
});

describe("workspace screens", () => {
  const pageDir = join(ROOT, "src", "app", "academy", "(workspace)");
  const componentDir = join(ROOT, "src", "components", "academy", "workspace");
  const pages = walk(pageDir).filter((path) => path.endsWith("page.tsx"));
  const files = [...walk(pageDir), ...walk(componentDir)].filter((path) => /\.tsx?$/.test(path));

  test("the launch-critical learner and teacher screens exist", () => {
    const routes = pages.map((path) => rel(path).replace("src/app/academy/(workspace)/", "").replace(/\/?page\.tsx$/, "")).sort();
    for (const route of [
      "learn",
      "teach",
      "class-groups/[classGroupId]",
      "class-groups/[classGroupId]/lessons/[lessonId]",
      "class-groups/[classGroupId]/announcements",
      "class-groups/[classGroupId]/content/[itemId]",
      "sessions/[sessionId]",
      "assignments/[assignmentId]",
      "attempts/[attemptId]",
      "messages",
      "messages/[threadId]",
      "notifications",
      "announcements",
      "certificates",
      "approvals",
      "approvals/[gateId]",
      "library/books/[bookId]",
      "recordings/[recordingId]",
    ]) {
      assert.ok(routes.includes(route), `missing screen: ${route}`);
    }
  });

  test("links placed in notifications by the services open real screens", () => {
    const serviceSources = walk(join(ROOT, "src", "lib", "academy", "services")).map((path) => readFileSync(path, "utf8")).join("\n");
    const links = [...serviceSources.matchAll(/link: `(\/academy\/[^`]+)`|"(\/academy\/[a-z/-]+)"\)/g)].map((m) => m[1] ?? m[2]);
    assert.ok(links.length >= 4, "the link scan would be vacuous");
    for (const link of links) {
      const route = link.replace(/\$\{[^}]+\}/g, "[id]").replace(/^\/academy\//, "");
      const candidates = pages.map((path) => rel(path).replace("src/app/academy/(workspace)/", "").replace(/\/?page\.tsx$/, "").replace(/\[\w+\]/g, "[id]"));
      assert.ok(candidates.includes(route), `notification link ${link} has no screen`);
    }
  });

  test("data is read and written only through the workspace API helpers", () => {
    for (const path of files) {
      const src = readFileSync(path, "utf8");
      const name = rel(path);
      if (!name.endsWith("workspace/api.ts")) {
        assert.doesNotMatch(src, /\bfetch\(|authFetch|axios|XMLHttpRequest/, `${name} bypasses the API helpers`);
      }
      assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB|document\.cookie/, `${name} uses browser storage`);
      assert.doesNotMatch(src, /dangerouslySetInnerHTML|innerHTML\s*=/, `${name} renders raw HTML`);
      assert.doesNotMatch(src, /@\/lib\/academy\/server|@\/lib\/db\/client|firebase-admin/, `${name} reaches server-only code`);
      assert.doesNotMatch(src, /import (?!type)[^;]*from "@\/lib\/academy\/services\//, `${name} imports a service at runtime`);
    }
    const paths = readFileSync(join(componentDir, "paths.ts"), "utf8");
    const apiPaths = [...paths.matchAll(/`(\/api\/[^`$?]+)/g), ...paths.matchAll(/"(\/api\/[^"]+)"/g)].map((m) => m[1]);
    assert.ok(apiPaths.length >= 30);
    for (const path of apiPaths) assert.match(path, /^\/api\/academy\//, `${path} is outside the academy API`);
  });

  test("screens are client pages that take ids from the route, never from storage or identity headers", () => {
    for (const path of pages) {
      const src = readFileSync(path, "utf8");
      assert.match(src, /^"use client";/, `${rel(path)} is not a client page`);
      assert.match(src, /export default function \w+\(/);
      // The caller's identity is never sent: no identity headers, no uid query, no sender/owner/author fields in bodies.
      assert.doesNotMatch(src, /x-user-id|x-user-role|[?&]uid=|senderUid:|ownerUid:|authorUid:/i, rel(path));
      if (rel(path).includes("[")) assert.match(src, /useParams</, `${rel(path)} does not read its route parameters`);
    }
  });

  test("layout classes are direction-neutral so Arabic renders right-to-left correctly", () => {
    for (const path of files) {
      const src = readFileSync(path, "utf8");
      assert.doesNotMatch(src, /["'\s](?:ml|mr|pl|pr|left|right)-\d|["'\s]text-(?:left|right)\b|["'\s](?:border-l|border-r|rounded-l|rounded-r)\b/, `${rel(path)} uses physical direction classes`);
      assert.doesNotMatch(src, /\b(?:bg|text|border)-(?:white|black|(?:gray|slate|zinc|neutral|stone|red|green|blue|yellow|emerald|amber)-\d{2,3})\b/, `${rel(path)} hard-codes colours`);
    }
  });

  test("text inputs, selects and text areas are given ids for their labels", () => {
    let controls = 0;
    for (const path of files) {
      const src = readFileSync(path, "utf8");
      for (const match of src.matchAll(/<(TextInput|SelectInput|TextArea)\b/g)) {
        controls++;
        const tag = src.slice(match.index, match.index + 240);
        assert.match(tag, /\bid=/, `${rel(path)}: a ${match[1]} has no id`);
      }
    }
    assert.ok(controls >= 20, `only ${controls} controls found; the check would be vacuous`);
  });

  test("the workspace is not indexed and resolves its locale on the server", () => {
    const layout = readFileSync(join(pageDir, "layout.tsx"), "utf8");
    assert.match(layout, /robots: \{ index: false, follow: false \}/);
    assert.match(layout, /resolveLocale\(\(await cookies\(\)\)\.get\(LOCALE_COOKIE\)\?\.value\)/);
    assert.ok(existsSync(join(componentDir, "shell.tsx")));
  });

  test("the site navigation leads into the academy: the public catalog and each role's home", () => {
    assert.equal(academyHome("admin"), "/academy/manage");
    assert.equal(academyHome("teacher", "active"), "/academy/teach");
    // A teacher account that is not active is sent to its application page, never to teaching.
    for (const status of [undefined, null, "", "pending", "changes_requested", "rejected", "withdrawn", "inactive", "ACTIVE"]) {
      assert.equal(academyHome("teacher", status), "/academy/teacher-application", String(status));
    }
    for (const role of ["student", null, undefined, "", "ADMIN", "unknown"]) assert.equal(academyHome(role, "active"), "/academy/learn", String(role));
    for (const home of ["manage", "teach", "learn", "teacher-application"]) assert.ok(existsSync(join(pageDir, home, "page.tsx")), home);
    assert.match(readFileSync(join(ROOT, "src", "components", "Navbar.tsx"), "utf8"), /const academyLink = academyHome\(role, status\);/);
    const navbar = readFileSync(join(ROOT, "src", "components", "Navbar.tsx"), "utf8");
    assert.match(navbar, /\{ to: "\/academy", label: "Academy"/);
    assert.equal(navbar.match(/href=\{academyLink\}/g)?.length, 2, "desktop and mobile account menus");
    for (const locale of ["en", "ar", "tr"]) {
      const messages = JSON.parse(readFileSync(join(ROOT, "src", "messages", `${locale}.json`), "utf8")) as Record<string, unknown>;
      for (const key of ["Academy", "My academy"]) assert.equal(typeof messages[key], "string", `${locale}: ${key}`);
    }
  });

  test("site navigation, footer and sitemap links open real pages", () => {
    const app = join(ROOT, "src", "app");
    const pageExists = (path: string) => existsSync(join(app, ...path.split("/").filter(Boolean), "page.tsx"));
    const navbar = readFileSync(join(ROOT, "src", "components", "Navbar.tsx"), "utf8");
    const footer = readFileSync(join(ROOT, "src", "components", "shared", "Footer.tsx"), "utf8");
    const sitemap = readFileSync(join(app, "sitemap.ts"), "utf8");
    const links = new Set([
      ...[...navbar.matchAll(/(?:href|to)[=:]\s*"(\/[^"?#]*)"/g)].map((m) => m[1]),
      ...[...footer.matchAll(/href="(\/[^"?#]*)"/g)].map((m) => m[1]),
      ...[...sitemap.matchAll(/\$\{baseUrl\}(\/[^`]*)`/g)].map((m) => m[1]),
    ]);
    assert.ok(links.size >= 20, `only ${links.size} links found`);
    const broken = [...links].filter((path) => path !== "/" && !pageExists(path));
    assert.deepEqual(broken, []);
    assert.ok(pageExists("/"), "home page");
  });
});
