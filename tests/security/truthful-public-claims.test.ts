/**
 * What the public site claims must be something the product can honour.
 *
 * Three claims could not be:
 *  - the homepage hero collected an address for an "early-bird 50% OFF" list and
 *    answered alert("Thank you! You've secured your 50% discount."). Nothing was
 *    stored: the submit handler had no request in it, and the waitlist table it
 *    would have needed does not exist in the deployment. A visitor was told they
 *    held a discount that no record anywhere knew about;
 *  - a testimonials section attributed invented quotes and five-star ratings to
 *    named people;
 *  - /assessments offered "Start Test" on a link to "#".
 *
 * The replacements state only what is true and invent nothing. Pricing is
 * Whop-only and per class group, so the hero points at the catalogue instead.
 *
 * These assertions also stand guard over the rest of the public pages: no
 * fabricated testimonial, no invented discount, and no dead call to action.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const APP = join(ROOT, "src", "app");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
/** Source with comments removed: a comment explaining a removed claim is not the claim. */
const code = (rel: string) => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const home = code("src/app/page.tsx");

describe("the homepage promises nothing it cannot keep", () => {
  test("no discount is offered and no confirmation is fabricated", () => {
    assert.doesNotMatch(home, /50%|discount|early-bird/i);
    assert.doesNotMatch(home, /alert\(/, "a browser alert is never a record of anything");
    assert.doesNotMatch(home, /Secure Discount|secured your/i);
  });

  test("the hero invites the visitor to the real catalogue", () => {
    assert.match(home, /href="\/academy"[\s\S]{0,200}<T>See the courses<\/T>/);
    for (const locale of ["en", "ar", "tr"]) {
      const messages = JSON.parse(read(`src/messages/${locale}.json`)) as Record<string, unknown>;
      assert.equal(typeof messages["See the courses"], "string", `${locale}: See the courses`);
    }
  });

  test("no email is collected by a form that stores nothing", () => {
    // The only honest options are a working store or no form; there is no waitlist table.
    assert.doesNotMatch(home, /<form/, "a form on the homepage must submit somewhere real");
    assert.doesNotMatch(home, /type="email"/);
  });

  test("no invented testimonial or rating remains", () => {
    assert.doesNotMatch(home, /testimonials/i);
    assert.doesNotMatch(home, /What our students say/i);
    assert.doesNotMatch(home, /Ahmed Al-Khalidi|Fatima Noor|Ustadh Bilal/);
    assert.doesNotMatch(home, /<Star\b/, "a five-star row is a rating claim");
  });
});

describe("no public page ships a dead call to action", () => {
  function pages(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return pages(full);
      return /\.(tsx)$/.test(entry) ? [full] : [];
    });
  }

  test('no page links a call to action at "#"', () => {
    const offenders: string[] = [];
    for (const file of pages(APP)) {
      const src = readFileSync(file, "utf8").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
      if (/href="#"/.test(src)) offenders.push(relative(ROOT, file).replace(/\\/g, "/"));
    }
    assert.deepEqual(offenders, [], "a link to # looks like an action the visitor can take");
  });

  test("the placement test says it is not open instead of offering itself", () => {
    const assessments = code("src/app/assessments/page.tsx");
    assert.doesNotMatch(assessments, /Start Test/);
    assert.match(assessments, /<T>The placement test is not open yet\.<\/T>/);
    for (const locale of ["en", "ar", "tr"]) {
      const messages = JSON.parse(read(`src/messages/${locale}.json`)) as Record<string, unknown>;
      assert.equal(typeof messages["The placement test is not open yet."], "string", locale);
    }
  });
});
