/**
 * Two legacy areas repaired during consolidation.
 *
 * Community, forum and challenges: the page and routes read a "session"
 * cookie the application never sets and took role and gender from token
 * claims it never issues, so every student was refused; the queries joined a
 * users table the application does not have. Membership now comes from the
 * central session (student) and the gender stored on the profile, never from
 * the request.
 *
 * Choosing a course from a subscription: the limit was checked in one
 * statement and the counter raised in another, so parallel requests could
 * choose more courses than paid for.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8");

describe("community membership", () => {
  test("members are signed-in students in the space of the gender on their profile", () => {
    const guard = read("src", "lib", "community-auth.ts");
    assert.match(guard, /const user = await requireStudent\(req\);/);
    assert.match(guard, /SELECT gender FROM profiles WHERE firebase_uid = \$\{uid\}/);
    assert.match(guard, /if \(!gender\) throw new HttpError\(403,/);
  });

  test("the community page is retired: it redirects to the academy and reads nothing", () => {
    // Its posts, forum and challenge tables exist in no schema this application runs on,
    // so the page and its navigation links are retired (P0 legacy compatibility repair).
    // The routes below keep their guards for any direct caller.
    const page = read("src", "app", "community", "page.tsx");
    assert.match(page, /redirect\("\/academy"\);/);
    assert.doesNotMatch(page, /getSession|communityGenderOf|sql`|fetch\(/);
  });

  test("routes take the member's uid and gender from the guard and join profiles for display names", () => {
    for (const rel of ["community/posts", "forum/questions"]) {
      const src = read("src", "app", "api", ...rel.split("/"), "route.ts");
      assert.match(src, /JOIN profiles u ON u\.firebase_uid = \w+\.user_uid/, rel);
      assert.match(src, /u\.full_name AS "userName"/, rel);
      assert.match(src, /const page = Math\.max\(1, Math\.min\(1000, parseInt\(searchParams\.get\('page'\) \|\| '1', 10\) \|\| 1\)\);/, rel);
    }
    for (const rel of ["community/comments", "community/likes", "forum/answers", "forum/vote", "challenges/join"]) {
      const src = read("src", "app", "api", ...rel.split("/"), "route.ts");
      assert.match(src, /const body = await req\.json\(\)\.catch\(\(\) => null\);/, `${rel}: malformed bodies are a 400, not a 500`);
    }
  });
});

describe("choosing a course from a subscription", () => {
  test("the limit is re-checked on the row being raised, and the choice is recorded only when the raise succeeded", () => {
    const src = read("src", "app", "api", "subscriptions", "choose-course", "route.ts");
    assert.match(src, /export const POST = withApi\(async \(req\) => \{\s*const user = await requireAuth\(req\);/);
    assert.match(src, /WITH counted AS \(\s*UPDATE subscriptions\s*SET course_used = course_used \+ 1\s*WHERE id = \$\{subscription\.id\} AND course_used < max_course AND expires_at > NOW\(\)\s*RETURNING id\s*\), chosen AS \(\s*INSERT INTO subscription_course \(subscription_id, course_id\)\s*SELECT id, \$\{course_id\} FROM counted/);
    assert.match(src, /if \(!outcome \|\| outcome\.chosen !== 1\)/);
    assert.ok(src.indexOf("outcome.chosen !== 1") < src.indexOf("INSERT INTO enrollments"), "enrollment only after the choice is recorded");
    assert.match(src, /JOIN profiles p ON s\.user_uid = p\.id\s*WHERE p\.firebase_uid = \$\{user\.uid\}/, "the documented subscription key");
  });
});
