/**
 * Referrals: invitation links without rewards.
 *
 * Found before this pass: /r/CODE saved the code in browser storage and signup
 * never sent it, so no invitation was ever attributed; POST /api/user let any
 * signed-in account set its own referrer (self-referral, forged or repeated
 * attribution) and overwrite its stored email; the dashboard showed dollar
 * "credits" and promised "50% off"; the affiliate page advertised a 20%
 * commission, PayPal or bank-transfer payouts, and a "code" made of the first
 * eight characters of the account's uid, which matched no account.
 *
 * Covered: code format and allocation, attribution only at student signup and
 * only by the server, the owner-only referral endpoint, the retired profile
 * upserts, and the absence of any financial reward in code or screens.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { REFERRAL_CODE_PATTERN, generateReferralCode, parseReferralCode, pickUnusedReferralCode, referralPath } from "../../src/lib/referral.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/--[^\n]*/g, "");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe("referral codes", () => {
  test("codes are 8 random upper-case hexadecimal characters; input is normalised and anything else is not a code", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const generated = generateReferralCode();
      assert.match(generated, REFERRAL_CODE_PATTERN);
      seen.add(generated);
    }
    assert.ok(seen.size > 190, "codes are random");
    assert.equal(parseReferralCode(" a1b2c3d4 "), "A1B2C3D4");
    for (const bad of ["", "A1B2C3D", "A1B2C3D45", "G1B2C3D4", "A1B2-3D4", "../admin", "A1B2C3D4'--", null, undefined, 12345678, {}]) {
      assert.equal(parseReferralCode(bad), null, String(bad));
    }
    assert.equal(referralPath("A1B2C3D4"), "/r/A1B2C3D4");
  });

  test("a new code is never one another account holds; allocation fails loudly rather than sharing a code", async () => {
    const taken = new Set(["AAAAAAAA", "BBBBBBBB"]);
    const sequence = ["AAAAAAAA", "BBBBBBBB", "CCCCCCCC"];
    assert.equal(await pickUnusedReferralCode(async (c) => taken.has(c), () => sequence.shift() as string), "CCCCCCCC");
    await assert.rejects(pickUnusedReferralCode(async () => true, () => "AAAAAAAA", 3), /unique referral code/);
    const helper = read("src", "lib", "referral-db.ts");
    assert.match(helper, /SELECT 1 FROM profiles WHERE referral_code = \$\{code\} LIMIT 1/);
    for (const signup of ["student", "teacher"]) {
      assert.match(read("src", "app", "api", "signup", signup, "route.ts"), /await newReferralCode\(\)/, signup);
      assert.doesNotMatch(read("src", "app", "api", "signup", signup, "route.ts"), /generateReferralCode\(\)/, signup);
    }
  });
});

describe("attribution", () => {
  test("an invitation link carries only a well-formed code to student signup, without browser storage", () => {
    const page = read("src", "app", "r", "[code]", "page.tsx");
    assert.match(page, /const code = parseReferralCode\(\(await params\)\.code\);\s*redirect\(code \? `\/signup\/student\?ref=\$\{code\}` : "\/signup"\);/);
    assert.doesNotMatch(page, /localStorage|"use client"/);
    assert.doesNotMatch(read("src", "app", "r", "layout.tsx"), /runtime\s*=\s*'edge'/, "the referral module needs the Node.js runtime");
    const signupPage = read("src", "app", "signup", "student", "page.tsx");
    assert.match(signupPage, /const referralCode = new URLSearchParams\(window\.location\.search\)\.get\("ref"\);/);
    assert.match(signupPage, /JSON\.stringify\(referralCode \? \{ \.\.\.data, referral_code: referralCode \} : data\)/);
  });

  test("student signup attributes once, on the server, to the owner of a valid code other than the new account, and removes a half-created account", () => {
    const route = code(read("src", "app", "api", "signup", "student", "route.ts"));
    assert.match(route, /const code = parseReferralCode\(referral_code\);/);
    assert.match(route, /WHERE referral_code = \$\{code\} AND firebase_uid <> \$\{userRecord\.uid\}/);
    assert.match(route, /referredBy = referrer\[0\]\.id;/);
    assert.match(route, /catch \(profileError\) \{\s*await auth\.deleteUser\(userRecord\.uid\)/, "no Firebase account without its profile");
    // Teacher signup takes no referral code.
    assert.doesNotMatch(code(read("src", "app", "api", "signup", "teacher", "route.ts")), /referral_code|referred_by|parseReferralCode/);
  });

  test("nothing else writes who referred an account", () => {
    const writers: string[] = [];
    for (const file of walk(join(ROOT, "src")).filter((path) => /\.(ts|tsx)$/.test(path))) {
      const src = code(readFileSync(file, "utf8"));
      if (/referred_by\s*=|referred_by\s*[,)][\s\S]{0,400}VALUES|UPDATE profiles SET[^`]*referred_by/.test(src)) writers.push(relative(ROOT, file).replace(/\\/g, "/"));
    }
    assert.deepEqual(writers, ["src/app/api/signup/student/route.ts"]);
  });

  test("the profile upserts that let an account set its referrer or email are retired", () => {
    const user = read("src", "app", "api", "user", "route.ts");
    const post = user.slice(user.indexOf("export const POST"));
    assert.match(post, /export const POST = withApi\(async \(req\) => \{\s*await requireAuth\(req\);\s*return NextResponse\.json\(\{ error: 'Profiles are created at signup and changed with PATCH\.' \}, \{ status: 410 \}\);/);
    assert.doesNotMatch(code(user), /referred_by|body\.email|INSERT INTO profiles/);
    const createProfile = read("src", "app", "api", "create-profile", "route.ts");
    assert.match(createProfile, /export async function POST\(\) \{\s*return Response\.json\(\s*\{ error: "This endpoint has been removed\." \},\s*\{ status: 410 \}/);
    assert.doesNotMatch(createProfile, /^import /m);
  });
});

describe("the owner's view", () => {
  test("GET and POST /api/referral answer only for the session's account, privately", () => {
    const route = read("src", "app", "api", "referral", "route.ts");
    assert.equal((route.match(/const user = await requireAuth\(req\);/g) ?? []).length, 2);
    assert.match(route, /WHERE p\.firebase_uid = \$\{uid\}/);
    assert.match(route, /ownReferral\(user\.uid\)/);
    assert.doesNotMatch(code(route), /searchParams|req\.json|body\./, "no account is named by the request");
    assert.match(route, /UPDATE profiles SET referral_code = \$\{code\} WHERE firebase_uid = \$\{user\.uid\} AND referral_code IS NULL/, "an existing code is never replaced");
    assert.match(route, /r\.referred_by::text = p\.id::text AND r\.firebase_uid <> p\.firebase_uid/, "the count never includes the account itself");
    assert.match(route, /"Cache-Control": "private, no-store"/);
    assert.match(route, /rewardsOffered: false/);
  });

  test("the invitation page shows the account's real link and says no rewards are offered", () => {
    const page = read("src", "app", "affiliate", "AffiliateContent.tsx");
    assert.match(page, /authFetch\("\/api\/referral", \{ method \}\)/);
    assert.match(page, /<T>Referral rewards are not offered at this time\.<\/T>/);
    assert.doesNotMatch(page, /uid\?*\.slice|localStorage/);
    assert.doesNotMatch(code(read("src", "app", "affiliate", "page.tsx")), /commission|\bearn(ings?)?\b/i);
  });
});

describe("no financial referral reward", () => {
  test("no screen or route promises, computes or pays a referral reward", () => {
    const offenders: string[] = [];
    const files = walk(join(ROOT, "src")).filter((path) => /\.(ts|tsx)$/.test(path) && !/src[\\/]messages[\\/]/.test(path));
    for (const file of files) {
      const src = code(readFileSync(file, "utf8"));
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      if (/referral_credits|referral_discount|referral_count/.test(src)) offenders.push(`${rel}: legacy reward column`);
      if (/\b\d{1,2}% commission|you both get|Easy Withdrawals|payouts? via PayPal|commission balance|earn \d{1,2}%/i.test(src)) offenders.push(`${rel}: reward promise`);
    }
    assert.deepEqual(offenders, []);
  });

  test("the student dashboard reports friends who joined, not credits", () => {
    const api = code(read("src", "app", "api", "student", "dashboard", "route.ts"));
    assert.match(api, /\(SELECT count\(\*\) FROM profiles r WHERE r\.referred_by::text = p\.id::text AND r\.firebase_uid <> p\.firebase_uid\)::int AS referral_joined/);
    assert.match(api, /count: Number\(profile\.referral_joined\) \|\| 0,/);
    assert.doesNotMatch(api, /credits/);
    const page = read("src", "app", "dashboard", "student", "page.tsx");
    assert.doesNotMatch(page, /credits|\$\{data\.referral|50% off/);
    assert.match(page, /<T>Friends who joined<\/T>/);
  });

  test("the unused teacher statistics card with invented referral figures is gone", () => {
    assert.equal(walk(join(ROOT, "src", "components", "dashboard")).some((path) => path.endsWith("TeacherStats.tsx")), false);
  });
});
