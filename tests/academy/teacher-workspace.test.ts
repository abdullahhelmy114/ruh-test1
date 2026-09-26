/**
 * The teacher workspace stays translated, honest and inside its permissions.
 *
 * Walks the teacher-facing sources for every dictionary path they render and
 * asserts each resolves in en, ar and tr; asserts the teacher surfaces never
 * call the risky legacy /api/teacher routes; and asserts no admin-only
 * capability (authoring, course upload, session creation) grew a control in
 * the teacher UI. The teacher profile's sentence keys must exist in ar and tr
 * because the site mechanism falls back to raw English otherwise.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WORKSPACE_MESSAGES } from "../../src/lib/academy/workspace/messages.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const teach = read("src/app/academy/(workspace)/teach/page.tsx");
const SOURCES = [
  teach,
  read("src/components/academy/workspace/class-group/staff.tsx"),
  read("src/app/academy/(workspace)/approvals/page.tsx"),
  read("src/app/academy/(workspace)/approvals/[gateId]/page.tsx"),
  read("src/app/academy/(workspace)/sessions/[sessionId]/page.tsx"),
  read("src/components/academy/workspace/referral.tsx"),
];
const source = SOURCES.join("\n");
const locales = ["en", "ar", "tr"] as const;

const paths = [...new Set([...source.matchAll(/\bt\.([a-zA-Z]+(?:\.[a-zA-Z]+)+)/g)].map((m) => m[1]))];

function resolve(locale: (typeof locales)[number], path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => {
    if (node === null || typeof node !== "object") return undefined;
    return (node as Record<string, unknown>)[key];
  }, WORKSPACE_MESSAGES[locale]);
}

describe("teacher workspace translation completeness", () => {
  test("the teacher surfaces reference a meaningful number of dictionary paths", () => {
    assert.ok(paths.length >= 40, `found ${paths.length} referenced paths`);
  });

  for (const locale of locales) {
    test(`${locale}: every referenced dictionary path resolves`, () => {
      const missing = paths.filter((path) => {
        const value = resolve(locale, path);
        if (typeof value === "string") return value.trim() === "";
        if (value !== null && typeof value === "object") {
          return Object.values(value).some((entry) => typeof entry === "string" && entry.trim() === "");
        }
        return true;
      });
      assert.deepEqual(missing, []);
    });
  }

  test("gate subjects and decision roles render localized, never as raw enums", () => {
    const list = read("src/app/academy/(workspace)/approvals/page.tsx");
    const gate = read("src/app/academy/(workspace)/approvals/[gateId]/page.tsx");
    assert.match(list, /t\.approvals\.kind\[gate\.subject\.kind/);
    assert.match(gate, /t\.approvals\.kind\[gate\.subject\.kind/);
    assert.match(gate, /t\.approvals\.role\[d\.decidedRole/);
  });

  test("the teacher profile's sentence keys exist in ar and tr", () => {
    const profile = read("src/components/profile/TeacherProfile.tsx");
    const keys = [
      ...[...profile.matchAll(/<T>([^<]+)<\/T>/g)].map((m) => m[1]),
      ...[...profile.matchAll(/tt\("([^"]+)"\)/g)].map((m) => m[1]),
    ];
    assert.ok(keys.length >= 20, `found ${keys.length} profile keys`);
    for (const locale of ["ar", "tr"] as const) {
      const messages = JSON.parse(read(`src/messages/${locale}.json`)) as Record<string, unknown>;
      const missing = keys.filter((key) => typeof messages[key] !== "string" || messages[key] === "");
      assert.deepEqual(missing, [], locale);
    }
  });
});

describe("teacher permission boundary", () => {
  test("the teacher workspace never calls the legacy /api/teacher routes", () => {
    assert.doesNotMatch(source, /\/api\/teacher\//, "legacy teacher APIs are retired for the workspace");
  });

  test("no admin-only capability grew a teacher control", () => {
    // session.manage, authoring and publishing are admin-only in permissions.ts;
    // the teacher home must not render a creation or authoring affordance.
    // Comments explain the rule and are not controls, so they are stripped first.
    const code = teach.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
    assert.doesNotMatch(code, /Authoring|Upload course|uploadCourse|New session|createSession|api\.adminAcademy|\/academy\/manage/i);
    assert.doesNotMatch(source, /"POST"[^\n]*\/sessions"/, "no teacher surface creates sessions");
  });

  test("the review queue aggregates only real per-group queue data", () => {
    assert.match(teach, /usePerGroup\(runningIds, api\.reviewQueue/);
    assert.doesNotMatch(teach, /Math\.random|fakeCount|placeholderCount/);
  });
});
