/**
 * End-to-end HTTP smoke test against a running build of the site.
 *
 * It needs no browser, no credentials and no database, so it can run
 * anywhere the app can start. It is not part of the unit run (the file does
 * not end in .test.ts); start a production build and point it at it:
 *
 *   DATABASE_URL=postgresql://e2e:e2e@127.0.0.1:9/e2e  (unreachable, local)
 *   ACADEMY_CORE_SCHEMA_READY=false                    (or true on a migrated dev database)
 *   next build && next start -p 3100
 *   E2E_BASE_URL=http://localhost:3100 node --test tests/e2e/http-smoke.e2e.ts
 *
 * Use "localhost" (the proxy redirects other plain-HTTP hosts to HTTPS).
 *
 * Covered through the real server: security headers; the public academy in
 * English, Arabic and Turkish (right-to-left for Arabic), in whichever state
 * the academy is in; signed-out access to every workspace screen; an
 * anonymous authorization sweep over every method of every API route that
 * is not deliberately public (tests/security/public-api-routes.ts) with
 * forged identity headers, forged tokens and cookies, and identity claimed
 * in the query and body (academy routes must answer the standard 401);
 * removed endpoints; public routes never returning internal error text;
 * public academy API contracts (read only, safe errors, rate limiting); and
 * the legacy messaging endpoints.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { PUBLIC_MESSAGES } from "../../src/lib/academy/public/messages.ts";
import { WORKSPACE_MESSAGES } from "../../src/lib/academy/workspace/messages.ts";
import { PUBLIC_API_ROUTES, PUBLIC_HANDLERS } from "../security/public-api-routes.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const BASE = process.env.E2E_BASE_URL?.replace(/\/+$/, "") ?? "";
const skip = BASE === "" ? "set E2E_BASE_URL to a running build (see the header of this file)" : false;

const LOCALES = ["en", "ar", "tr"] as const;
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const SAMPLE_UUID = "00000000-0000-4000-8000-000000000001";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function url(path: string): string {
  return `${BASE}${path}`;
}

async function get(path: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(url(path), { headers, redirect: "manual" });
}

interface RouteFile {
  /** Relative to src/app/api, as in PUBLIC_API_ROUTES. */
  readonly rel: string;
  readonly path: string;
  readonly methods: readonly string[];
  /** Answers 410 as a removed endpoint. */
  readonly removed: boolean;
  /** Some methods are exported only to answer 405. */
  readonly methodNotAllowed: boolean;
}

/** Every route handler under an API directory with the URL it serves and the methods it exports. */
function routesUnder(apiDir: string): RouteFile[] {
  const base = join(ROOT, "src", "app");
  return walk(join(base, apiDir))
    .filter((file) => file.endsWith("route.ts"))
    .map((file) => {
      const src = readFileSync(file, "utf8");
      const methods = METHODS.filter((m) => new RegExp(`export (?:const ${m}\\b|(?:async )?function ${m}\\b)`).test(src));
      const path = `/${relative(base, file).replace(/\\/g, "/").replace(/\/route\.ts$/, "")}`
        .replace(/\[\.\.\.[^\]]+\]/g, "x")
        .replace(/\[pageNumber\]/g, "1")
        .replace(/\[key\]/g, "lesson_sheet.release")
        .replace(/\[[^\]]+\]/g, SAMPLE_UUID);
      const rel = relative(join(base, "api"), file).replace(/\\/g, "/");
      return { rel, path, methods, removed: /This endpoint has been removed\./.test(src), methodNotAllowed: /status: 405/.test(src) };
    })
    .filter((route) => route.methods.length > 0)
    .sort((a, b) => a.path.localeCompare(b.path));
}

async function expectUnauthorized(response: Response, label: string): Promise<void> {
  const body = (await response.json().catch(() => null)) as unknown;
  assert.equal(response.status, 401, `${label}: expected 401, got ${response.status} ${JSON.stringify(body)}`);
  assert.deepEqual(body, { error: "Unauthorized", code: "UNAUTHORIZED" }, label);
}

/**
 * Values (not field labels, which the administration screens show as text)
 * that must never reach a signed-out visitor. React escapes quotes inside
 * the page payload, so the HTML is unescaped first.
 */
function assertNoPrivateValues(html: string, label: string): void {
  const text = html.replace(/\\"/g, "\"");
  assert.doesNotMatch(text, /firebase_uid|learner_uid|teacher_uid|meeting_url/, label);
  assert.doesNotMatch(text, /"(?:learnerUid|teacherUid|senderUid|privateNote)":"[^"]|"email":"[^"]*@|"(?:meetingUrl|pdfUrl|recordingUrl)":"https?:/, label);
  assert.doesNotMatch(text, /"(?:correctIndex|correctValue)":\s*(?:\d|true|false)|"answerKey":\s*[{[]/, label);
}

/** Legacy routes answer in older shapes (some 403 with a localized message); they must still deny and return nothing else. */
async function expectDenied(response: Response, label: string): Promise<void> {
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  assert.ok(response.status === 401 || response.status === 403, `${label}: expected 401 or 403, got ${response.status} ${JSON.stringify(body)}`);
  assert.ok(body !== null && typeof body.error === "string", `${label}: JSON error body`);
  assert.deepEqual(Object.keys(body).filter((key) => key !== "error" && key !== "code"), [], `${label}: no data beside the error`);
}

type Forgery = readonly [label: string, headers: Record<string, string>];

const FORGERIES: readonly Forgery[] = [
  ["no credentials", {}],
  ["forged identity headers", { "x-user-id": "admin-1", "x-user-role": "admin", "x-forwarded-for": "127.0.0.1", "x-real-ip": "127.0.0.1" }],
  ["forged bearer token", { authorization: "Bearer not-a-firebase-token" }],
  ["forged session cookie", { cookie: "__session=not-a-session-cookie" }],
];

/** Sends every method of every route once per forgery, with identity also claimed in the query and body. */
async function sweep(
  routes: readonly { readonly path: string; readonly methods: readonly string[] }[],
  expectation: (response: Response, label: string) => Promise<void>,
): Promise<number> {
  let checked = 0;
  for (const route of routes) {
    for (const method of route.methods) {
      for (const [label, headers] of FORGERIES) {
        const hasBody = method !== "GET" && method !== "DELETE";
        const response = await fetch(url(`${route.path}?uid=admin-1&role=admin`), {
          method,
          redirect: "manual",
          headers: { ...headers, ...(hasBody ? { "content-type": "application/json" } : {}) },
          body: hasBody ? JSON.stringify({ uid: "admin-1", role: "admin", learnerUid: "student-1", expectedRevision: 1 }) : undefined,
        });
        await expectation(response, `${method} ${route.path} (${label})`);
        checked += 1;
      }
    }
  }
  return checked;
}

describe("security headers", { skip }, () => {
  test("pages and API responses carry the site's security headers", async () => {
    for (const path of ["/academy", "/api/public/academy/catalog", "/api/academy/me/learning"]) {
      const response = await get(path);
      const h = response.headers;
      assert.equal(h.get("x-frame-options"), "SAMEORIGIN", path);
      assert.equal(h.get("x-content-type-options"), "nosniff", path);
      assert.equal(h.get("referrer-policy"), "strict-origin-when-cross-origin", path);
      assert.match(h.get("strict-transport-security") ?? "", /max-age=\d+/, path);
      assert.match(h.get("permissions-policy") ?? "", /camera=\(\)/, path);
      assert.match(h.get("content-security-policy") ?? "", /frame-ancestors 'self'.*object-src 'none'/, path);
      assert.equal(h.get("x-powered-by"), null, path);
      await response.arrayBuffer();
    }
  });
});

describe("public academy pages", { skip }, () => {
  test("render in each locale, right-to-left for Arabic, in the academy's current state", async () => {
    const catalog = await get("/api/public/academy/catalog");
    const ready = catalog.status === 200;
    await catalog.arrayBuffer();
    for (const locale of LOCALES) {
      const t = PUBLIC_MESSAGES[locale];
      const cookie = { cookie: `preferred-locale=${locale}` };
      for (const path of ["/academy", "/academy/programs/arabic-foundations", "/academy/courses/nahw-1"]) {
        const response = await get(path, cookie);
        const html = await response.text();
        const label = `${locale} ${path}`;
        assert.ok(response.status === 200 || (ready && response.status === 404), `${label}: ${response.status}`);
        assert.match(html, new RegExp(`<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"`), label);
        if (!ready) assert.ok(html.includes(t.notAvailable), `${label}: shows the not-available state`);
        assertNoPrivateValues(html, label);
      }
      const catalogPage = await (await get("/academy", cookie)).text();
      assert.ok(catalogPage.includes(t.catalogTitle), `${locale}: catalog title`);
    }
  });

  test("certificate verification is a labelled form that search engines do not index", async () => {
    for (const locale of LOCALES) {
      const html = await (await get("/academy/certificates/verify", { cookie: `preferred-locale=${locale}` })).text();
      assert.ok(html.includes(PUBLIC_MESSAGES[locale].verifyTitle), locale);
      assert.match(html, /<label[^>]*for="code"/, locale);
      assert.match(html, /<meta name="robots" content="noindex/, locale);
    }
  });
});

describe("signed-in workspace", { skip }, () => {
  const pageDir = join(ROOT, "src", "app", "academy", "(workspace)");
  const staticPages = walk(pageDir)
    .filter((file) => file.endsWith("page.tsx"))
    .map((file) => `/academy/${relative(pageDir, file).replace(/\\/g, "/").replace(/\/?page\.tsx$/, "")}`.replace(/\/$/, ""))
    .map((path) => path.replace(/\[[^\]]+\]/g, SAMPLE_UUID));

  test("every workspace screen answers signed-out visitors without data and is not indexed", async () => {
    assert.ok(staticPages.length >= 35, `only ${staticPages.length} workspace screens found`);
    for (const path of staticPages) {
      const response = await get(path);
      const html = await response.text();
      assert.equal(response.status, 200, path);
      assert.match(html, /<meta name="robots" content="noindex, nofollow"/, path);
      assertNoPrivateValues(html, path);
    }
  });

  test("workspace text follows the reader's locale", async () => {
    for (const locale of LOCALES) {
      const html = await (await get("/academy/learn", { cookie: `preferred-locale=${locale}` })).text();
      assert.ok(html.includes(WORKSPACE_MESSAGES[locale].nav.skip), locale);
    }
  });
});

describe("anonymous authorization sweep", { skip }, () => {
  const all = routesUnder("api");
  const isAcademy = (r: RouteFile) => r.path.startsWith("/api/academy/") || r.path.startsWith("/api/admin/academy/");
  const academy = all.filter(isAcademy);
  const publicMethods = (r: RouteFile): readonly string[] => PUBLIC_HANDLERS[r.rel]?.methods ?? [];
  const otherPrivate = all
    .filter((r) => !isAcademy(r) && !(r.rel in PUBLIC_API_ROUTES) && !r.removed)
    .map((r) => ({ ...r, methods: r.methods.filter((m) => !publicMethods(r).includes(m)) }))
    .filter((r) => r.methods.length > 0);

  test("the sweep covers the academy APIs and every other private API route", () => {
    assert.ok(academy.filter((r) => r.path.startsWith("/api/academy/")).length >= 40);
    assert.ok(academy.filter((r) => r.path.startsWith("/api/admin/academy/")).length >= 45);
    assert.ok(otherPrivate.length >= 120, `only ${otherPrivate.length} other private routes found`);
    assert.ok(otherPrivate.filter((r) => r.path.startsWith("/api/admin/")).length >= 40);
  });

  test("every method of every academy route answers 401 to callers without a verified identity", async () => {
    const checked = await sweep(academy, expectUnauthorized);
    assert.ok(checked >= 500, `only ${checked} requests checked`);
  });

  test("every method of every other private route denies callers without a verified identity", async () => {
    const plain = otherPrivate.filter((r) => !r.methodNotAllowed);
    const checked = await sweep(plain, expectDenied);
    assert.ok(checked >= 500, `only ${checked} requests checked`);
    // Routes that answer 405 for some methods must still deny the methods they serve.
    for (const route of otherPrivate.filter((r) => r.methodNotAllowed)) {
      for (const method of route.methods) {
        const response = await fetch(url(route.path), { method, redirect: "manual", headers: { "content-type": "application/json" }, body: method === "GET" ? undefined : "{}" });
        const body = await response.text();
        assert.ok([401, 403, 405].includes(response.status), `${method} ${route.path}: ${response.status} ${body}`);
      }
    }
  });

  test("removed endpoints answer 410 and public routes never return internal error text", async () => {
    for (const route of all.filter((r) => r.removed)) {
      for (const method of route.methods) {
        const response = await fetch(url(route.path), { method, redirect: "manual", headers: { "content-type": "application/json" }, body: method === "GET" ? undefined : "{}" });
        assert.equal(response.status, 410, `${method} ${route.path}`);
        assert.deepEqual(await response.json(), { error: "This endpoint has been removed." });
      }
    }
    const publicRoutes = all
      .filter((r) => r.rel in PUBLIC_API_ROUTES || r.rel in PUBLIC_HANDLERS)
      .map((r) => ({ ...r, methods: r.rel in PUBLIC_API_ROUTES ? r.methods : publicMethods(r) }));
    assert.equal(publicRoutes.length, Object.keys(PUBLIC_API_ROUTES).length + Object.keys(PUBLIC_HANDLERS).length, "every listed public route was found");
    for (const route of publicRoutes) {
      // Only reads and empty bodies: validation answers before any provider or email is contacted.
      for (const method of route.methods.filter((m) => m === "GET" || m === "POST")) {
        const response = await fetch(url(route.path), {
          method,
          redirect: "manual",
          headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.200" },
          body: method === "POST" ? "{}" : undefined,
        });
        const body = await response.text();
        const label = `${method} ${route.path} (${response.status})`;
        assert.doesNotMatch(body, /Error connecting|TypeError|ReferenceError|ECONNREFUSED|malformed|neon|postgres|at \S+ \(|node_modules/i, label);
        assert.ok(response.status !== 200 || method === "GET", `${label}: an empty POST must not succeed`);
      }
    }
  });

  test("the sign-in exchange rejects forged tokens without explaining why", async () => {
    // Not JWT-shaped, so verification fails locally without fetching provider keys.
    for (const idToken of ["not-a-firebase-token", "x".repeat(4096)]) {
      const response = await fetch(url("/api/auth/session"), {
        method: "POST",
        redirect: "manual",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      assert.equal(response.status, 401, idToken);
      assert.deepEqual(await response.json(), { error: "Unauthorized" });
      assert.equal(response.headers.get("set-cookie"), null, "no session cookie");
    }
  });

  test("legacy messaging endpoints refuse anonymous callers", async () => {
    await expectUnauthorized(await fetch(url("/api/messages"), { redirect: "manual" }), "GET /api/messages");
    for (const path of ["/api/messages", "/api/chat/send"]) {
      const response = await fetch(url(path), {
        method: "POST",
        redirect: "manual",
        headers: { "content-type": "application/json", "x-user-id": "admin-1", "x-user-role": "admin" },
        body: JSON.stringify({ receiverId: "student-1", content: "hello", channel: "private-x" }),
      });
      await expectUnauthorized(response, `POST ${path}`);
    }
  });
});

describe("public API contracts", { skip }, () => {
  const publicRoutes = ["/api/public/academy/catalog", "/api/public/academy/programs/arabic-foundations", "/api/public/academy/courses/nahw-1", "/api/public/certificates/RQ-AAAA-BBBB-CCCC"];

  test("public routes answer with data or a safe error, never internals", async () => {
    for (const path of publicRoutes) {
      const response = await get(path, { "x-forwarded-for": "198.51.100.10" });
      const body = (await response.json()) as Record<string, unknown>;
      if (response.status === 200) {
        assert.deepEqual(Object.keys(body), ["data"], path);
        assert.doesNotMatch(JSON.stringify(body), /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|uid|email/i, path);
      } else {
        assert.ok([404, 503].includes(response.status), `${path}: ${response.status}`);
        assert.deepEqual(Object.keys(body), ["error"], path);
        assert.doesNotMatch(String(body.error), /at \w+ \(|stack|sql|neon|postgres|ECONN/i, path);
      }
    }
  });

  test("public routes are read-only", async () => {
    for (const path of publicRoutes) {
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        const response = await fetch(url(path), { method, redirect: "manual" });
        await response.arrayBuffer();
        assert.equal(response.status, 405, `${method} ${path}`);
      }
    }
  });

  test("public program lookups are rate limited per client before any work", async () => {
    // A documentation-range address unique to this run keeps other clients' buckets untouched.
    const client = { "x-forwarded-for": `203.0.113.${1 + (process.pid % 250)}` };
    let limited: Response | null = null;
    for (let i = 0; i < 125 && limited === null; i++) {
      const response = await get(`/api/public/academy/programs/program-${i}`, client);
      if (response.status === 429) limited = response;
      else await response.arrayBuffer();
    }
    assert.ok(limited, "no 429 within 125 requests");
    assert.match(limited.headers.get("retry-after") ?? "", /^\d+$/);
    assert.deepEqual(await limited.json(), { error: "Too many requests" });
    const other = await get("/api/public/academy/programs/arabic-foundations", { "x-forwarded-for": "198.51.100.77" });
    await other.arrayBuffer();
    assert.notEqual(other.status, 429, "another client is not limited");
  });
});
