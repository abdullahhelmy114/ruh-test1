/**
 * Public product: catalog service, public API routes, public pages, and the
 * trilingual strings behind them.
 *
 * Required invariants covered here: public data contains no identifiers of
 * people, counts, content or unpublished material; malformed slugs never
 * reach the database; public routes are rate limited before any work and
 * never authenticate from headers; public pages are server-rendered, reach
 * data only through services, and handle unavailable, empty and not-found
 * states; every English string exists in Arabic and Turkish.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { PUBLIC_MESSAGES, formatPublicDate } from "../../src/lib/academy/public/messages.ts";
import * as publicRepo from "../../src/lib/academy/repo/public-repo.ts";
import { createPublicService } from "../../src/lib/academy/services/public-service.ts";
import { IDS, assertWellFormed, fakeExecutor, rejectsDomain, type Rule } from "./support.ts";

const ROOT = join(import.meta.dirname, "..", "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const R = {
  programs: /FROM academy_programs WHERE status = 'active'/,
  courses: /FROM academy_courses c\s+LEFT JOIN academy_programs p[\s\S]*WHERE c\.status = 'active' AND c\.deleted_at IS NULL\s+ORDER BY/,
  course: /WHERE c\.slug = \$1/,
  outline: /FROM academy_curricula cu/,
  groups: /FROM academy_class_groups cg/,
};

function world(overrides: Partial<Record<keyof typeof R, Rule["rows"]>> = {}): Rule[] {
  const rows: Record<string, Rule["rows"]> = {
    programs: [{ slug: "arabic-foundations", title: "Arabic Foundations", description: null }],
    courses: [{ slug: "nahw-1", title: "Nahw 1", description: "Grammar basics", program_slug: "arabic-foundations", program_title: "Arabic Foundations" }],
    course: [{ id: IDS.course, slug: "nahw-1", title: "Nahw 1", description: null, program_slug: null, program_title: null }],
    outline: [
      { unit_position: 1, unit_title: "Sentences", lesson_position: 1, lesson_title: "Nominal sentence", planned_minutes: 60 },
      { unit_position: 1, unit_title: "Sentences", lesson_position: 2, lesson_title: "Verbal sentence", planned_minutes: null },
      { unit_position: 2, unit_title: "Particles", lesson_position: null, lesson_title: null, planned_minutes: null },
    ],
    groups: [
      { name: "Autumn cohort", status: "planned", starts_on: "2026-10-01", ends_on: "2026-12-20", is_full: false },
      { name: "Evening cohort", status: "active", starts_on: null, ends_on: null, is_full: true },
    ],
    ...overrides,
  };
  return (Object.keys(R) as (keyof typeof R)[]).map((key) => ({ match: R[key], rows: rows[key] }));
}

const service = (rules: Rule[], ready = true) => {
  const executor = fakeExecutor(rules);
  return { executor, svc: createPublicService({ executor, flags: { coreSchemaReady: ready }, clock: () => new Date("2026-09-17T12:00:00Z") }) };
};

describe("public catalog service", () => {
  test("the catalog lists active programs and courses only", async () => {
    const { svc } = service(world());
    const catalog = await svc.catalog();
    assert.equal(catalog.courses[0].program?.title, "Arabic Foundations");
    assert.deepEqual(Object.keys(catalog.courses[0]).sort(), ["description", "program", "slug", "title"]);
  });

  test("a course shows outline titles and upcoming classes without people or counts", async () => {
    const { svc, executor } = service(world());
    const course = await svc.course("nahw-1");
    assert.deepEqual(course.outline, [
      { title: "Sentences", lessons: [{ title: "Nominal sentence", plannedMinutes: 60 }, { title: "Verbal sentence", plannedMinutes: null }] },
      { title: "Particles", lessons: [] },
    ]);
    assert.deepEqual(course.upcomingClassGroups.map((g) => g.availability), ["open", "full"]);
    const json = JSON.stringify(course);
    assert.equal(json.includes(IDS.course), false, "internal identifiers are not published");
    for (const key of ["uid", "email", "capacity", "enroll", "teacher", "meeting"]) assert.equal(json.toLowerCase().includes(key), false, key);
    const groupsQuery = executor.queries.find((q) => R.groups.test(q.text));
    assert.equal(groupsQuery?.values[1], "2026-09-17");
  });

  test("malformed slugs are not found without touching the database; unknown courses are not found", async () => {
    for (const bad of ["", "ab", "Nahw-1", "nahw_1", "../admin", "x".repeat(81)]) {
      const { svc, executor } = service(world());
      await rejectsDomain(svc.course(bad), "NOT_FOUND");
      assert.equal(executor.queries.length, 0, bad);
    }
    await rejectsDomain(service(world({ course: [] })).svc.course("nahw-9"), "NOT_FOUND");
  });

  test("reports 'not available yet' before the academy schema exists", async () => {
    const { svc, executor } = service(world(), false);
    await rejectsDomain(svc.catalog(), "FEATURE_UNAVAILABLE");
    assert.equal(executor.queries.length, 0);
  });

  test("public queries select only publishable columns and require published or active state", () => {
    const queries = [
      publicRepo.selectPublicProgramsQuery(),
      publicRepo.selectPublicCoursesQuery(),
      publicRepo.selectPublicCourseQuery("nahw-1"),
      publicRepo.selectPublicOutlineQuery(IDS.course),
      publicRepo.selectPublicClassGroupsQuery(IDS.course, "2026-09-17"),
    ];
    for (const query of queries) {
      assertWellFormed(query);
      assert.doesNotMatch(query.text, /teacher_uid|learner_uid|email|meeting_url|content|created_by|full_name/);
    }
    assert.match(publicRepo.selectPublicOutlineQuery(IDS.course).text, /v\.state = 'published'/);
    assert.match(publicRepo.selectPublicClassGroupsQuery(IDS.course, "2026-09-17").text, /cg\.deleted_at IS NULL AND cg\.status IN \('planned', 'active'\)/);
  });
});

describe("public strings", () => {
  test("Arabic and Turkish define every English string, non-empty", () => {
    const keys = Object.keys(PUBLIC_MESSAGES.en).sort();
    for (const locale of ["ar", "tr"] as const) {
      assert.deepEqual(Object.keys(PUBLIC_MESSAGES[locale]).sort(), keys, locale);
      for (const key of keys) assert.ok(PUBLIC_MESSAGES[locale][key as keyof typeof PUBLIC_MESSAGES.en].trim().length > 0, `${locale}.${key}`);
    }
    assert.match(PUBLIC_MESSAGES.ar.catalogTitle, /[؀-ۿ]/);
  });

  test("dates are formatted in the reader's language without shifting the calendar day", () => {
    assert.equal(formatPublicDate("2026-10-01", "en"), "1 October 2026");
    assert.match(formatPublicDate("2026-10-01", "tr"), /Ekim/);
    assert.match(formatPublicDate("2026-10-01", "ar"), /[؀-ۿ]/);
    assert.equal(formatPublicDate("not-a-date", "en"), "not-a-date");
  });
});

describe("public routes", () => {
  const API = join(ROOT, "src", "app", "api", "public");
  const routes = walk(API).filter((path) => path.endsWith("route.ts"));

  test("the expected public routes exist", () => {
    assert.deepEqual(routes.map((path) => relative(API, path).replace(/\\/g, "/")).sort(), [
      "academy/catalog/route.ts",
      "academy/courses/[slug]/route.ts",
      "certificates/[code]/route.ts",
    ]);
  });

  for (const path of routes) {
    const rel = relative(API, path).replace(/\\/g, "/");
    const src = readFileSync(path, "utf8");
    test(`${rel}: read-only, rate limited first, never authenticates from headers`, () => {
      assert.match(src, /export const GET = withApi/);
      assert.doesNotMatch(src, /export const (POST|PUT|PATCH|DELETE)|export (async )?function/);
      const limitAt = src.indexOf("checkRateLimit(");
      assert.ok(limitAt > 0 && limitAt < src.indexOf("Service."), "rate limit before service call");
      assert.doesNotMatch(src, /requireAuth|requireAdmin|getSession|x-user-id|x-forwarded-for|@\/lib\/db\/client|@neondatabase|catch\s*\(/);
    });
  }
});

describe("public pages", () => {
  const APP = join(ROOT, "src", "app", "academy");
  const pages = walk(APP).filter((path) => path.endsWith("page.tsx"));

  test("the expected public pages exist", () => {
    assert.deepEqual(pages.map((path) => relative(APP, path).replace(/\\/g, "/")).sort(), ["certificates/verify/page.tsx", "courses/[slug]/page.tsx", "page.tsx"]);
  });

  for (const path of pages) {
    const rel = relative(APP, path).replace(/\\/g, "/");
    const src = readFileSync(path, "utf8");
    test(`${rel}: server-rendered, data only through services, handles unavailable state`, () => {
      assert.doesNotMatch(src, /^["']use client["']/m);
      assert.doesNotMatch(src, /@\/lib\/db\/client|@neondatabase|academy\/(repo|services)\//);
      assert.doesNotMatch(src, /requireAuth|x-user-id|localStorage|dangerouslySetInnerHTML/);
      assert.match(src, /FEATURE_UNAVAILABLE/);
      assert.match(src, /t\.notAvailable/);
      assert.match(src, /publicLocale\(\)/);
      assert.doesNotMatch(src, /\b(ml|mr|pl|pr)-\d|text-(left|right)\b/, "use logical spacing so RTL works");
      if (rel.includes("[")) assert.match(src, /await params/);
    });
  }

  test("the verification page rate limits before verifying and marks results for screen readers", () => {
    const src = readFileSync(join(APP, "certificates", "verify", "page.tsx"), "utf8");
    assert.ok(src.indexOf("checkRateLimit(") < src.indexOf("certificateService.verify("));
    assert.match(src, /aria-live="polite"/);
    assert.match(src, /<label htmlFor="code"/);
    assert.match(src, /robots: \{ index: false/);
  });
});
