/**
 * P0 legacy compatibility repair (2026-09-19).
 *
 * Production moved to a new Neon database whose schema is the academy
 * (migrations 0001-0011) plus `profiles`. It logged, on every homepage visit:
 *   courses error: relation "live_course" does not exist   (GET /api/courses)
 *   Bundles error: relation "bundles" does not exist        (GET /api/bundles)
 * and the static inventory found more launch-path readers of tables outside
 * that schema: the signed-in navigation polled legacy notifications, messages
 * and cart tables on every page, and students and administrators landed on
 * legacy dashboards that read `live_course`, `enrollments`, `course`,
 * `transactions` and `payouts`.
 *
 * The repair: the homepage lists academy courses from the public academy
 * catalog, bundle, cart, wishlist, community and legacy course screens redirect
 * into the academy, the navigation reads academy notifications and message
 * threads, and every account lands on its academy home. These tests keep each
 * of those from regressing, and prove statically that no launch-path page, or
 * any API route it calls, can reach a query against the retired tables.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { ADMIN_HOME, LEARNER_HOME, TEACHER_APPLICATION_HOME, TEACHER_WORKSPACE_HOME, accountHome } from "../../src/lib/auth/home.ts";
import { academyHome } from "../../src/components/academy/workspace/paths.ts";

const ROOT = path.join(import.meta.dirname, "..", "..");
const APP = path.join(ROOT, "src", "app");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
/** Source with comments removed, so a comment that mentions a pattern cannot satisfy or break an assertion. */
const code = (rel: string) => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const pageExists = (route: string) => existsSync(path.join(APP, ...route.split("/").filter(Boolean), "page.tsx"));

// ---------------------------------------------------------------------------
// The homepage
// ---------------------------------------------------------------------------
describe("the homepage lists academy courses and no bundles", () => {
  const home = code("src/app/page.tsx");

  test("courses come from the public academy catalog, never from the legacy course list", () => {
    assert.match(home, /const CATALOG_API = "\/api\/public\/academy\/catalog";/);
    assert.match(home, /fetch\(CATALOG_API\)/);
    assert.doesNotMatch(home, /\/api\/courses|\/api\/course\b|live_course/);
  });

  test("no bundle is fetched, shown or linked, and no price is displayed", () => {
    assert.doesNotMatch(home, /\/api\/bundles|href="\/bundles"|bundle/i);
    assert.doesNotMatch(home, /\.price\b|\$\$\{/, "the catalog publishes no prices; the homepage invents none");
  });

  test("every course card opens the canonical academy course page by slug", () => {
    const hrefs = [...home.matchAll(/href=\{`([^`]*)`\}/g)].map((m) => m[1]).filter((href) => /course/.test(href));
    assert.ok(hrefs.length >= 3, "title, image and button links");
    for (const href of hrefs) assert.equal(href, "/academy/courses/${encodeURIComponent(course.slug)}");
    assert.doesNotMatch(home, /href=\{?[`"]\/course\/|href="\/courses"/);
    assert.match(home, /href="\/academy"/, "the full catalog is one link away");
  });

  test("an empty catalog says so, and an unreadable one claims nothing", () => {
    assert.match(home, /<T>No courses are open yet\. Please check back soon\.<\/T>/);
    assert.match(home, /\.catch\(\(\) => setFeaturedCourses\("unavailable"\)\)/);
    assert.match(home, /r\.ok \? r\.json\(\) : Promise\.reject/, "a failed response is not read as a course list");
    for (const locale of ["en", "ar", "tr"]) {
      const messages = JSON.parse(read(`src/messages/${locale}.json`)) as Record<string, unknown>;
      for (const key of ["Academy courses", "Part of", "View course", "View all courses", "No courses are open yet. Please check back soon."]) {
        assert.equal(typeof messages[key], "string", `${locale}: ${key}`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Retired legacy endpoints
// ---------------------------------------------------------------------------
describe("the legacy course-list and bundle endpoints are retired", () => {
  test("GET /api/courses and GET /api/bundles answer 410 without touching the database", () => {
    for (const rel of ["src/app/api/courses/route.ts", "src/app/api/bundles/route.ts"]) {
      const src = code(rel);
      assert.match(src, /\{ error: "This endpoint has been removed\." \},\s*\{ status: 410 \}/, rel);
      assert.doesNotMatch(src, /@\/lib\/db|sql`|sql\.query|live_course|FROM bundles/, rel);
      assert.deepEqual([...src.matchAll(/export (?:async function|const) (\w+)/g)].map((m) => m[1]), ["GET"], rel);
    }
  });

  test("the administrator bundle endpoint answers 410 to administrators only and touches no table", () => {
    const src = code("src/app/api/admin/bundles/route.ts");
    assert.equal([...src.matchAll(/await requireAdmin\(req\);\s*return moved\(\);/g)].length, 2, "GET and POST");
    assert.match(src, /\{ status: 410 \}/);
    assert.doesNotMatch(src, /@\/lib\/db|sql`|sql\.query|FROM bundles|INTO bundles/);
  });
});

// ---------------------------------------------------------------------------
// Redirects into the academy
// ---------------------------------------------------------------------------
const REDIRECTS: ReadonlyArray<{ page: string; to: string; route: string }> = [
  { page: "src/app/courses/page.tsx", to: '"/academy"', route: "/academy" },
  { page: "src/app/course/[courseId]/page.tsx", to: '"/academy"', route: "/academy" },
  { page: "src/app/bundles/page.tsx", to: '"/academy"', route: "/academy" },
  { page: "src/app/messages/page.tsx", to: '"/academy/messages"', route: "/academy/messages" },
  { page: "src/app/cart/page.tsx", to: '"/academy"', route: "/academy" },
  { page: "src/app/wishlist/page.tsx", to: '"/academy"', route: "/academy" },
  { page: "src/app/community/page.tsx", to: '"/academy"', route: "/academy" },
  { page: "src/app/dashboard/student/page.tsx", to: "LEARNER_HOME", route: LEARNER_HOME },
  { page: "src/app/dashboard/student/course/[courseId]/page.tsx", to: "LEARNER_HOME", route: LEARNER_HOME },
  { page: "src/app/dashboard/student/course/[courseId]/points/page.tsx", to: "LEARNER_HOME", route: LEARNER_HOME },
  { page: "src/app/dashboard/student/course/[courseId]/practice/page.tsx", to: "LEARNER_HOME", route: LEARNER_HOME },
  { page: "src/app/dashboard/student/course/exam/courseId/page.tsx", to: "LEARNER_HOME", route: LEARNER_HOME },
  { page: "src/app/dashboard/admin/page.tsx", to: "ADMIN_HOME", route: ADMIN_HOME },
  { page: "src/app/dashboard/admin/bundles/page.tsx", to: '"/academy/manage"', route: "/academy/manage" },
  { page: "src/app/live/[lessonId]/page.tsx", to: '"/dashboard"', route: "/dashboard" },
];

describe("retired legacy screens redirect into the academy and read nothing", () => {
  for (const { page, to, route } of REDIRECTS) {
    test(`${page.replace(/^src\/app/, "").replace(/\/page\.tsx$/, "")} → ${route}`, () => {
      const src = code(page);
      assert.match(src, new RegExp(`export default function \\w+\\(\\) \\{\\s*redirect\\(${to.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\);\\s*\\}`), page);
      assert.doesNotMatch(src, /"use client"|fetch\(|sql`|useEffect/, page);
      assert.ok(pageExists(route.replace(/^\/academy\//, "/academy/(workspace)/")) || pageExists(route), `${route} is a real page`);
    });
  }

  test("the retired screens under the client-side admin layout redirect before rendering", () => {
    // A page-level redirect() under that layout is streamed (HTTP 200) and followed only
    // once the layout renders its children, so these two also redirect in the config.
    const config = code("next.config.ts");
    for (const source of ["/dashboard/admin", "/dashboard/admin/bundles"]) {
      assert.match(config, new RegExp(`\\{ source: "${source}", destination: "/academy/manage", permanent: false \\}`), source);
    }
    assert.match(read("src/app/dashboard/admin/layout.tsx"), /^"use client";/, "the reason still holds");
    assert.equal([...config.matchAll(/\{ source: /g)].length, 2, "no other path is redirected in the config");
  });

  test("the retired screens keep no layout of their own", () => {
    for (const dir of ["courses", "bundles", "cart", "wishlist", "messages", "live/[lessonId]"]) {
      assert.equal(existsSync(path.join(APP, ...dir.split("/"), "layout.tsx")), false, dir);
    }
  });
});

// ---------------------------------------------------------------------------
// Account homes
// ---------------------------------------------------------------------------
describe("every account lands on its academy home", () => {
  test("students (and unknown roles) land on /academy/learn; administrators on /academy/manage", () => {
    assert.equal(LEARNER_HOME, "/academy/learn");
    assert.equal(ADMIN_HOME, "/academy/manage");
    for (const role of ["student", null, undefined, "", "superuser"]) assert.equal(accountHome(role, "active"), LEARNER_HOME, String(role));
    for (const status of ["active", null, "pending"]) assert.equal(accountHome("admin", status), ADMIN_HOME, String(status));
    assert.equal(accountHome("teacher", "active"), TEACHER_WORKSPACE_HOME);
    for (const status of ["pending", "changes_requested", "rejected", "inactive", null]) {
      assert.equal(accountHome("teacher", status), TEACHER_APPLICATION_HOME, String(status));
    }
  });

  test("the sign-in home and the navigation's academy home are the same rule", () => {
    for (const role of ["admin", "teacher", "student", null, undefined, ""]) {
      for (const status of ["active", "pending", "inactive", null, undefined]) {
        assert.equal(accountHome(role, status), academyHome(role, status), `${String(role)}/${String(status)}`);
      }
    }
  });

  test("no sign-in, verification, onboarding or navigation path points at a legacy dashboard", () => {
    for (const rel of [
      "src/lib/auth/home.ts",
      "src/app/login/page.tsx",
      "src/app/onboarding/page.tsx",
      "src/app/verify-email/page.tsx",
      "src/app/dashboard/page.tsx",
      "src/app/api/auth/session/route.ts",
      "src/app/api/verify-email-code/route.ts",
      "src/lib/firebase/AuthProvider.tsx",
      "src/components/Navbar.tsx",
    ]) {
      assert.doesNotMatch(code(rel), /\/dashboard\/(student|admin)/, rel);
    }
    assert.match(code("src/app/dashboard/page.tsx"), /router\.replace\(LEARNER_HOME\);/, "the least-privileged fallback is the learner workspace");
  });
});

// ---------------------------------------------------------------------------
// Signed-in navigation
// ---------------------------------------------------------------------------
describe("the signed-in navigation reads academy notifications and message threads", () => {
  const navbar = code("src/components/Navbar.tsx");

  test("it polls academy notifications and threads, never the legacy notification, message or cart APIs", () => {
    assert.doesNotMatch(navbar, /"\/api\/notifications"|\/api\/messages\/unread-count|\/api\/cart|\/api\/wishlist/);
    assert.match(navbar, /authFetch\(academyApi\.notifications\(false\)\)/);
    assert.match(navbar, /authFetch\(academyApi\.threads\)/);
    assert.match(navbar, /setUnreadNotifications\(typeof d\.data\.unreadCount === "number" \? d\.data\.unreadCount : 0\)/);
    assert.match(navbar, /setUnreadMessages\(unreadAcross\(d\.data\)\)/);
    assert.equal(
      [...navbar.matchAll(/if \(!user \|\| isLoading \|\| applicant\) return;/g)].length,
      2,
      "applicants, refused by the academy, are not polled - not even before their role has loaded",
    );
  });

  test("messages open the academy conversations; cart, wishlist and community are gone", () => {
    assert.match(navbar, /href=\{academyPages\.messages\}/);
    assert.doesNotMatch(navbar, /"\/messages"|"\/cart"|"\/wishlist"|"\/community"|"\/courses"|"\/bundles"/);
    assert.doesNotMatch(navbar, /cartCount|ShoppingCart|Heart\b/);
    assert.match(navbar, /\{ to: "\/academy", label: "Academy" \}/, "the academy catalog is a primary link");
  });

  test("footer, sitemaps and the site guide list no retired page", () => {
    const retired = /ruhulqudus\.com\/(courses|bundles|community|wishlist|cart)\b|href="\/(courses|bundles|community|wishlist|cart)"|\$\{baseUrl\}\/(courses|bundles|community)`/;
    for (const rel of ["src/components/shared/Footer.tsx", "src/app/sitemap.ts", "public/sitemap.xml", "public/llms.txt"]) {
      assert.doesNotMatch(read(rel), retired, rel);
      assert.doesNotMatch(read(rel), /\/dashboard\/(student|admin)/, rel);
    }
  });
});

// ---------------------------------------------------------------------------
// Static guarantee: no launch-path page reaches a retired table
// ---------------------------------------------------------------------------

/** Tables outside the academy schema that no launch path may query (the P0 list plus the legacy navigation tables). */
const FORBIDDEN = ["live_course", "bundles", "course", "categories", "reviews", "cart_items", "wishlist", "community_posts", "forum_questions", "challenges", "notifications", "messages"];

/**
 * Launch-path pages: the public site, sign-in and account homes, the academy catalog,
 * workspace homes and checkout, and every retired screen (which must now read nothing).
 * Library, dictionary and Quran pages are deliberately excluded: they depend on legacy
 * content tables with no academy replacement and are decided separately.
 */
const LAUNCH_PAGES = [
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/academy/page.tsx",
  "src/app/academy/programs/[slug]/page.tsx",
  "src/app/academy/courses/[slug]/page.tsx",
  "src/app/academy/certificates/verify/page.tsx",
  "src/app/academy/(workspace)/learn/page.tsx",
  "src/app/academy/(workspace)/teach/page.tsx",
  "src/app/academy/(workspace)/manage/page.tsx",
  "src/app/academy/(workspace)/messages/page.tsx",
  "src/app/academy/(workspace)/notifications/page.tsx",
  "src/app/academy/(workspace)/teacher-application/page.tsx",
  "src/app/academy/(workspace)/checkout/[checkoutId]/page.tsx",
  "src/app/certification/page.tsx",
  "src/app/about/page.tsx",
  "src/app/contact/page.tsx",
  "src/app/privacy/page.tsx",
  "src/app/terms/page.tsx",
  "src/app/refund-policy/page.tsx",
  "src/app/terms-of-sale/page.tsx",
  "src/app/assessments/page.tsx",
  "src/app/affiliate/page.tsx",
  "src/app/login/page.tsx",
  "src/app/signup/page.tsx",
  "src/app/signup/student/page.tsx",
  "src/app/signup/teacher/page.tsx",
  "src/app/verify-email/page.tsx",
  "src/app/onboarding/page.tsx",
  "src/app/forgot-password/page.tsx",
  "src/app/dashboard/page.tsx",
  ...REDIRECTS.map((r) => r.page),
];

function resolveImport(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else return null;
  for (const ext of ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx", "/index.js"]) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

// Per-file caches: 45 launch pages share most of their files.
const SOURCES = new Map<string, string>();
function source(file: string): string {
  let text = SOURCES.get(file);
  if (text === undefined) SOURCES.set(file, (text = readFileSync(file, "utf8")));
  return text;
}
const DIRECT_IMPORTS = new Map<string, string[]>();
function directImports(file: string): string[] {
  let targets = DIRECT_IMPORTS.get(file);
  if (targets === undefined) {
    targets = [];
    for (const m of source(file).matchAll(/(?:^|\n)\s*(?:import|export)\s+(?!type\s)[^;]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
      const target = resolveImport(file, m[1] ?? m[2]);
      if (target) targets.push(target);
    }
    DIRECT_IMPORTS.set(file, targets);
  }
  return targets;
}

/** Every file statically or dynamically imported from the entries, transitively (type-only imports excluded). */
function importClosure(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...entries];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    stack.push(...directImports(file));
  }
  return seen;
}

/** The layouts that wrap a page, from the root down. */
function layoutsFor(page: string): string[] {
  const layouts: string[] = [];
  for (let dir = path.dirname(page); dir.startsWith(APP); dir = path.dirname(dir)) {
    const layout = path.join(dir, "layout.tsx");
    if (existsSync(layout)) layouts.push(layout);
  }
  return layouts;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const API_ROUTES = walk(path.join(APP, "api"))
  .filter((file) => file.endsWith(`${path.sep}route.ts`))
  .map((file) => ({ file, segments: path.relative(APP, path.dirname(file)).split(path.sep) }));

/** The route file an API path (with `[x]` for interpolated parts) resolves to. */
function routeFor(url: string): string | null {
  const segments = url.split("/").filter(Boolean);
  let best: { file: string; score: number } | null = null;
  for (const route of API_ROUTES) {
    const catchAll = route.segments.length > 0 && /^\[\.\.\..+\]$/.test(route.segments[route.segments.length - 1]);
    if (catchAll ? segments.length < route.segments.length : segments.length !== route.segments.length) continue;
    let score = 0;
    let ok = true;
    for (let i = 0; i < route.segments.length; i++) {
      const part = route.segments[i];
      if (/^\[\.\.\..+\]$/.test(part)) break;
      if (part === segments[i]) score += 2;
      else if (/^\[.+\]$/.test(part) || segments[i] === "[x]") score += 1;
      else {
        ok = false;
        break;
      }
    }
    if (ok && (!best || score > best.score)) best = { file: route.file, score };
  }
  return best?.file ?? null;
}

/**
 * API paths named anywhere in a source file. An interpolated path segment becomes `[x]`; an
 * interpolation glued to the end of a segment is a query string (`${unreadOnly ? "?..." : ""}`) and is dropped.
 */
function apiPaths(src: string): string[] {
  // Also `${SITE_URL}/api/...`: a server route calling another route over HTTP.
  return [...src.matchAll(/["'`}](\/api\/(?:[A-Za-z0-9_\-/.[\]]|\$\{[^}]*\})*)/g)].map((m) =>
    m[1].replace(/([^/])\$\{[^}]*\}/g, "$1").replace(/\$\{[^}]*\}/g, "[x]").replace(/\/+$/, ""),
  );
}

/** String and template literals that read as SQL (a statement verb with its table clause). */
function sqlLiterals(src: string): string[] {
  return [...src.matchAll(/`((?:[^`\\]|\\.)*)`|'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)]
    .map((m) => m[1] ?? m[2] ?? m[3] ?? "")
    .filter((text) => /\b(select\b[\s\S]*\bfrom|insert\s+into|update\s+"?[\w${}]+"?\s+(?:as\s+\w+\s+)?set|delete\s+from)\b/i.test(text));
}

/** SQL whose table name is interpolated (`FROM "${table}"`): no static reading can say which table it queries. */
function dynamicTableSql(src: string): boolean {
  return sqlLiterals(src).some((text) => /\b(?:from|join|into|update)\s+"?\$\{/i.test(text));
}

/** Interpolated table names that are provably academy tables, each with the line that proves it. */
const BOUNDED_DYNAMIC_TABLES: Readonly<Record<string, RegExp>> = {
  "src/lib/academy/repo/curriculum-repo.ts": /const target = table === "academy_units" \? "academy_units" : "academy_lessons";/,
};

/**
 * The route files an API path can reach. A path that names no route is a base that other code extends
 * (`const BASE = "/api/admin/academy"`), so every route under it counts - an over-approximation, never a gap.
 */
function routesFor(url: string): string[] {
  const exact = routeFor(url);
  if (exact) return [exact];
  const prefix = path.relative(APP, path.join(APP, ...url.split("/").filter(Boolean))).split(path.sep);
  return API_ROUTES.filter((r) => prefix.every((part, i) => r.segments[i] === part)).map((r) => r.file);
}

/** Tables named by SQL in a source file: FROM / JOIN / INTO / UPDATE ... SET / DELETE FROM inside string or template literals that read as SQL. */
function sqlTables(src: string): Set<string> {
  const tables = new Set<string>();
  for (const text of sqlLiterals(src)) {
    const ctes = new Set([...text.matchAll(/\b(\w+)\s+as\s*\(/gi)].map((c) => c[1].toLowerCase()));
    for (const t of text.matchAll(/\b(?:from|join|into|update|delete\s+from)\s+(?:only\s+)?"?(?:public\.)?([a-z_][a-z0-9_]*)"?/gi)) {
      const name = t[1].toLowerCase();
      if (!ctes.has(name)) tables.add(name);
    }
  }
  return tables;
}

/**
 * Everything a launch page can execute: the page, its layouts and their imports; every API route
 * named there; and, because routes may call further routes over HTTP, every route named in those,
 * until nothing new is reached.
 */
function launchReach(rel: string): { files: Set<string>; routes: Set<string>; unmatched: string[] } {
  const page = path.join(ROOT, rel);
  const files = importClosure([page, ...layoutsFor(page)]);
  const routes = new Set<string>();
  const unmatched: string[] = [];
  const scanned = new Set<string>();
  for (let grew = true; grew; ) {
    grew = false;
    for (const file of [...files]) {
      if (scanned.has(file)) continue;
      scanned.add(file);
      for (const url of apiPaths(source(file))) {
        const reached = routesFor(url);
        if (reached.length === 0) unmatched.push(`${path.relative(ROOT, file)}: ${url}`);
        for (const route of reached) {
          if (routes.has(route)) continue;
          routes.add(route);
          for (const next of importClosure([route])) files.add(next);
          grew = true;
        }
      }
    }
  }
  return { files, routes, unmatched };
}

describe("static guarantee: launch paths never query a retired legacy table", () => {
  test("the launch path list names real pages", () => {
    for (const rel of LAUNCH_PAGES) assert.ok(existsSync(path.join(ROOT, rel)), rel);
  });

  for (const rel of LAUNCH_PAGES) {
    test(`${rel.replace(/^src\/app/, "") || "/"} and every API route it calls`, () => {
      const { files, unmatched } = launchReach(rel);
      const offenders: string[] = [];
      for (const file of files) {
        const src = source(file);
        const where = path.relative(ROOT, file).replace(/\\/g, "/");
        for (const table of sqlTables(src)) if (FORBIDDEN.includes(table)) offenders.push(`${where} queries ${table}`);
        if (dynamicTableSql(src) && !BOUNDED_DYNAMIC_TABLES[where]?.test(src)) offenders.push(`${where} interpolates a table name into SQL`);
      }
      assert.deepEqual(offenders, []);
      // A path that matches no route would be a 404 the analysis cannot follow; there must be none.
      assert.deepEqual(unmatched, []);
    });
  }

  test("the analysis does see the retired tables where they still are (it is not vacuous)", () => {
    // Had the old navigation or the old student home stayed, their API calls would be caught here.
    const reachedBy = (urls: string[]) =>
      new Set([...importClosure(urls.flatMap(routesFor))].flatMap((f) => [...sqlTables(source(f))]));
    const legacy = reachedBy(["/api/course", "/api/cart", "/api/notifications", "/api/messages/unread-count", "/api/student/dashboard"]);
    for (const table of ["course", "cart_items", "notifications", "messages", "live_course"]) assert.ok(legacy.has(table), table);
    assert.equal(routeFor("/api/public/academy/catalog"), path.join(APP, "api", "public", "academy", "catalog", "route.ts"));
    assert.equal(routeFor("/api/academy/notifications"), path.join(APP, "api", "academy", "notifications", "route.ts"));
    assert.deepEqual(apiPaths('`/api/academy/notifications${unreadOnly ? "?unreadOnly=true" : ""}`'), ["/api/academy/notifications"]);
    assert.deepEqual(apiPaths("fetch(`${SITE_URL}/api/academy-info`)"), ["/api/academy-info"], "server-to-server calls are followed");
    assert.equal(dynamicTableSql('sql.query(`SELECT COUNT(*) FROM "${table}";`)'), true);
    assert.deepEqual(apiPaths("`/api/academy/sessions/${e(id)}/attendance`"), ["/api/academy/sessions/[x]/attendance"]);
    assert.ok(routesFor("/api/admin/academy").length > 20, "a base path reaches every route under it");
    // The site assistant on every page reaches /api/academy-info through /api/ai/chat (server to server).
    const shell = launchReach("src/app/layout.tsx").routes;
    for (const route of [["ai", "chat"], ["academy-info"], ["academy", "notifications"], ["academy", "messages", "threads"]]) {
      assert.ok(shell.has(path.join(APP, "api", ...route, "route.ts")), route.join("/"));
    }
  });

  test("the site assistant's facts come from the academy catalog alone", () => {
    const src = code("src/app/api/academy-info/route.ts");
    assert.match(src, /const catalog = await publicService\.catalog\(\);/);
    assert.doesNotMatch(src, /\bSELECT\b|\bFROM [a-z_]|sql`|sql\.query|neon\(|@\/lib\/db/, "no query of its own");
    assert.doesNotMatch(src, /runtime = "edge"/, "the academy services run on Node");
  });
});
