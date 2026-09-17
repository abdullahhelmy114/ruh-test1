/**
 * Content-Security-Policy: one canonical source, and the narrowest set of
 * hosts the product actually needs.
 *
 * A real teacher signup was blocked because the browser uploads the CV and
 * introduction video straight to https://api.cloudinary.com (with a signature
 * this server issues first) while connect-src did not allow that host. The
 * fix is that one host; these tests keep it from widening into a wildcard and
 * keep the rest of the policy intact.
 *
 * The same policy is checked on a running build in tests/e2e/http-smoke.e2e.ts
 * ("pages and API responses carry the site's security headers"), which reads
 * the header the browser actually receives.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const config = readFileSync(join(ROOT, "next.config.ts"), "utf8");

/** The policy as configured: the string literals of the CSP array, with the dev-only conditional removed. */
function directives(): Map<string, string[]> {
  const block = /key: "Content-Security-Policy",\s*value: \[([\s\S]*?)\]\.join\("; "\)/.exec(config);
  assert.ok(block, "the CSP array must stay in next.config.ts");
  // One entry per line: a string literal, optionally followed by a comma and a trailing comment.
  const parts = [...block[1].matchAll(/^\s*(?:`|")([^`"]+)(?:`|")\s*,?\s*(?:\/\/.*)?$/gm)].map((m) => m[1]);
  // The script-src entry is a template literal split by the development-only ${...} expression.
  const template = /`script-src ([^`]*)`/.exec(block[1]);
  if (template) parts.push(`script-src ${template[1].replace(/\$\{[\s\S]*?\}/g, " ")}`);
  const map = new Map<string, string[]>();
  for (const part of parts) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (!map.has(name)) map.set(name, sources);
  }
  return map;
}

describe("content security policy", () => {
  const csp = directives();

  test("one canonical source: only next.config.ts defines the policy", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx|mjs|js)$/.test(path)) files.push(path);
      }
    };
    walk(join(ROOT, "src"));
    const definers = files.filter((path) => /Content-Security-Policy/i.test(readFileSync(path, "utf8"))).map((path) => relative(ROOT, path).replace(/\\/g, "/"));
    assert.deepEqual(definers, [], "no source file may set a second CSP header");
    assert.equal((config.match(/Content-Security-Policy/g) ?? []).length, 1);
    // The proxy sets the other security headers but never a competing policy.
    const proxy = readFileSync(join(ROOT, "src", "proxy.ts"), "utf8");
    assert.doesNotMatch(proxy, /Content-Security-Policy/i);
    assert.match(proxy, /Strict-Transport-Security/);
  });

  test("connect-src allows the Cloudinary upload API host and nothing broader", () => {
    const connect = csp.get("connect-src");
    assert.ok(connect, "connect-src must be set");
    assert.ok(connect.includes("https://api.cloudinary.com"), "the browser's signed upload needs this exact host");
    for (const tooBroad of ["*", "https:", "https://*", "https://*.cloudinary.com", "https://res.cloudinary.com", "data:", "'unsafe-inline'"]) {
      assert.equal(connect.includes(tooBroad), false, `connect-src must not include ${tooBroad}`);
    }
    // The hosts the rest of the product depends on stay.
    for (const host of ["'self'", "https://*.googleapis.com", "https://*.firebaseio.com", "wss://*.firebaseio.com", "https://*.google-analytics.com", "https://generativelanguage.googleapis.com"]) {
      assert.ok(connect.includes(host), `connect-src must keep ${host}`);
    }
  });

  test("no Cloudinary delivery host is added anywhere: application documents stay private", () => {
    for (const [name, sources] of csp) {
      if (name === "connect-src") continue;
      for (const source of sources) assert.doesNotMatch(source, /cloudinary/i, `${name} must not name a Cloudinary host`);
    }
    // Nothing in the application fetches or embeds the public delivery host.
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(path) ? [path] : [];
      });
    const offenders = walk(join(ROOT, "src")).filter((path) => /res\.cloudinary\.com/.test(readFileSync(path, "utf8"))).map((path) => relative(ROOT, path).replace(/\\/g, "/"));
    assert.deepEqual(offenders, []);
  });

  test("the rest of the policy keeps its protections", () => {
    assert.deepEqual(csp.get("default-src"), ["'self'"]);
    assert.deepEqual(csp.get("object-src"), ["'none'"]);
    assert.deepEqual(csp.get("frame-ancestors"), ["'self'"]);
    assert.deepEqual(csp.get("base-uri"), ["'self'"]);
    assert.deepEqual(csp.get("form-action"), ["'self'"]);
    assert.ok(csp.get("img-src")?.includes("'self'"));
    assert.ok(csp.get("media-src")?.includes("'self'"));
    assert.ok(config.includes("upgrade-insecure-requests"));
    // 'unsafe-eval' stays development-only (React Fast Refresh); 'unsafe-inline' in script-src and
    // style-src is the pre-existing, documented exception and must not spread to other directives.
    assert.match(config, /isDevelopment \? " 'unsafe-eval'" : ""/);
    assert.equal((config.match(/'unsafe-eval'/g) ?? []).length, 1);
    for (const [name, sources] of csp) {
      if (name === "script-src" || name === "style-src") continue;
      assert.equal(sources.includes("'unsafe-inline'"), false, `${name} must not allow inline`);
      assert.equal(sources.includes("'unsafe-eval'"), false, `${name} must not allow eval`);
    }
  });

  test("the upload the policy allows is still server-signed and privately delivered", () => {
    const client = readFileSync(join(ROOT, "src", "lib", "security", "signed-upload-client.ts"), "utf8");
    const signAt = client.indexOf('fetch("/api/cloudinary/sign-upload"');
    const uploadAt = client.indexOf("cloudinaryUploadUrl(auth.cloudName, purpose)");
    assert.ok(signAt > 0 && uploadAt > signAt, "the signature is requested before the upload");
    assert.match(client, /formData\.append\("signature", auth\.signature\)/);
    assert.match(client, /formData\.append\("type", auth\.deliveryType\)/);
    const purposes = readFileSync(join(ROOT, "src", "lib", "security", "upload-purpose.ts"), "utf8");
    assert.equal((purposes.match(/deliveryType: "authenticated",/g) ?? []).length, 2, "both purposes stay authenticated");
    assert.doesNotMatch(purposes, /deliveryType: "(upload|public|private)"/);
  });
});
