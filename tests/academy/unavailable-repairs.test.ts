/**
 * Repairs from the unavailable-features audit (2026-09-21).
 *
 * Three narrow defects, each of which made a working thing look broken or a
 * broken thing look fine:
 *
 *  1. Session recordings embed the privacy-preserving YouTube host, but that
 *     host was never added to the Content-Security-Policy, so the player was
 *     blocked in every browser.
 *  2. The footer's "About Dr. Jehan" link had href="#", so it went nowhere
 *     although /about exists.
 *  3. The library page treated a failed request as an empty library and told
 *     visitors "No books found". Its tables are absent in the deployment, so
 *     that is exactly what production shows today.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
/** Source with comments removed, so a comment cannot satisfy an assertion. */
const code = (rel: string) => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

describe("session recordings can actually play", () => {
  const config = code("next.config.ts");
  const page = code("src/app/academy/(workspace)/recordings/[recordingId]/page.tsx");

  test("every YouTube host the app embeds is allowed by frame-src", () => {
    const frameSrc = /"frame-src ([^"]+)"/.exec(config)?.[1] ?? "";
    assert.ok(frameSrc.length > 0, "the CSP must define frame-src");
    const embedded = new Set(
      [...read("src/app/academy/(workspace)/recordings/[recordingId]/page.tsx").matchAll(/https:\/\/([a-z0-9.-]+)\/embed\//g)].map((m) => m[1]),
    );
    assert.ok(embedded.has("www.youtube-nocookie.com"), "the recordings page embeds the privacy-preserving host");
    for (const host of embedded) {
      assert.ok(frameSrc.includes(`https://${host}`), `frame-src must allow ${host}, or the player is blocked`);
    }
    assert.ok(page.includes("youtube-nocookie"), "keep the privacy-preserving host");
  });

  test("the policy is defined in one place, so there is no second list to update", () => {
    assert.equal([...config.matchAll(/frame-src/g)].length, 1);
  });
});

describe("the footer leads somewhere", () => {
  test("no footer link is a dead anchor, and About opens the page that exists", () => {
    const footer = code("src/components/shared/Footer.tsx");
    assert.doesNotMatch(footer, /href="#"/, "a link that goes nowhere is worse than no link");
    assert.match(footer, /<Link href="\/about"[\s\S]{0,120}About Dr\. Jehan/);
  });
});

describe("the library page never claims to be empty when it failed", () => {
  const page = code("src/app/library/page.tsx");

  test("a non-ok response is recorded as a failure, not as an empty list", () => {
    assert.match(page, /const \[failed, setFailed\] = useState\(false\);/);
    assert.match(page, /\} else \{\s*setFailed\(true\);\s*\}/, "a failed books request must set the flag");
    assert.match(page, /catch \(err\) \{[\s\S]{0,120}setFailed\(true\);/, "a thrown request must set it too");
  });

  test("the empty state tells the truth in all three languages", () => {
    assert.match(page, /failed \? <T>The library could not be loaded\. Please try again later\.<\/T> : <T>No books found<\/T>/);
    for (const locale of ["en", "ar", "tr"]) {
      const messages = JSON.parse(read(`src/messages/${locale}.json`)) as Record<string, unknown>;
      const value = messages["The library could not be loaded. Please try again later."];
      assert.equal(typeof value, "string", `${locale} is missing the message`);
      assert.ok(String(value).trim().length > 0, locale);
    }
  });
});
