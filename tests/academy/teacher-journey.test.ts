/**
 * The teacher applicant's journey through the site: signup, sign-in routing,
 * the application page and the navigation around it.
 *
 * The server decides access (see tests/auth/core.test.ts and
 * tests/academy/teachers.test.ts); these tests pin down that every place that
 * routes an account uses the one role-and-status rule, that no page trusts
 * browser storage, that the signup page sends exactly the contract the server
 * validates, and that the applicant route verifies upload proofs.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TEACHER_APPLICATION_HOME, TEACHER_WORKSPACE_HOME, accountHome } from "../../src/lib/auth/home.ts";
import { parseApplicationDetails } from "../../src/lib/academy/teachers/applications.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8");
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("where an account lands", () => {
  test("only an active teacher reaches the teacher workspace; every other teacher account reaches its application page", () => {
    assert.equal(accountHome("admin", "active"), "/dashboard/admin");
    assert.equal(accountHome("admin", null), "/dashboard/admin");
    assert.equal(accountHome("teacher", "active"), TEACHER_WORKSPACE_HOME);
    for (const status of ["pending", "changes_requested", "rejected", "withdrawn", "inactive", null, undefined, "", "Active"]) {
      assert.equal(accountHome("teacher", status), TEACHER_APPLICATION_HOME, String(status));
    }
    for (const role of ["student", null, undefined, "", "superuser"]) assert.equal(accountHome(role, "active"), "/dashboard/student", String(role));
    assert.ok(existsSync(join(ROOT, "src", "app", "academy", "(workspace)", "teacher-application", "page.tsx")));
    assert.ok(existsSync(join(ROOT, "src", "app", "academy", "(workspace)", "teach", "page.tsx")));
  });

  test("the session endpoint, login, the dashboard redirect and the navbar all use that rule, never browser storage", () => {
    const session = stripComments(read("src", "app", "api", "auth", "session", "route.ts"));
    assert.match(session, /SELECT role, status FROM profiles WHERE firebase_uid = \$\{decoded\.uid\}/);
    assert.match(session, /home: accountHome\(role, status\)/);

    const login = stripComments(read("src", "app", "login", "page.tsx"));
    assert.equal(/pendingTeacher|\/dashboard\/teacher|localStorage|sessionStorage/.test(login), false, "no client-side teacher gate or stale teacher dashboard");
    assert.match(login, /data\.home\.startsWith\("\/"\) && !data\.home\.startsWith\("\/\/"\)/, "only same-site paths are followed");
    assert.equal((login.match(/redirectAfterLogin\(data\)/g) ?? []).length, 2, "email and social sign-in both use it");

    const dashboard = stripComments(read("src", "app", "dashboard", "page.tsx"));
    assert.match(dashboard, /router\.replace\(accountHome\(profile\.role, profile\.status\)\)/);
    assert.equal(/localStorage|sessionStorage|\/dashboard\/teacher/.test(dashboard), false);

    const provider = stripComments(read("src", "lib", "firebase", "AuthProvider.tsx"));
    assert.match(provider, /setStatus\(typeof data\.profile\.status === "string" \? data\.profile\.status : null\)/);
    assert.equal(/localStorage|sessionStorage/.test(provider), false);

    const navbar = stripComments(read("src", "components", "Navbar.tsx"));
    assert.match(navbar, /const dashboardLink = accountHome\(role, status\);/);
  });

  test("an applicant's workspace navigation offers only the application page", () => {
    const shell = stripComments(read("src", "components", "academy", "workspace", "shell.tsx"));
    assert.match(shell, /const applicant = role === "teacher" && status !== "active";/);
    assert.match(shell, /const items: NavItem\[\] = applicant\s*\?\s*\[\{ href: academyHome\(role, status\), label: homeLabel \}\]/);
    assert.match(shell, /useApi<\{ unreadCount: number \}>\(user && !applicant \?/);
  });
});

describe("teacher signup", () => {
  test("signup offers teaching as an application, reached from the role chooser", () => {
    const chooser = read("src", "app", "signup", "page.tsx");
    assert.match(chooser, /router\.push\("\/signup\/teacher"\)/);
    assert.match(chooser, /<T>Apply to teach<\/T>/);
    assert.match(read("src", "app", "signup", "teacher", "details", "page.tsx"), /redirect\("\/signup\/teacher"\)/, "the old second step no longer exists");
    for (const locale of ["en", "ar", "tr"]) {
      const messages = JSON.parse(read("src", "messages", `${locale}.json`)) as Record<string, unknown>;
      for (const key of ["Apply to teach", "Your application is reviewed by the academy before you can teach.", "Once approved: your assigned classes, lesson preparation, attendance and grading.", "Sign in to follow your application"]) {
        assert.equal(typeof messages[key], "string", `${locale}: ${key}`);
      }
    }
    assert.match(read("src", "app", "verify-teacher", "page.tsx"), /router\.push\("\/login"\)/, "after verifying the email, the applicant signs in to follow the review");
  });

  test("the page sends exactly the contract the server validates and keeps no credentials in browser storage", () => {
    const page = stripComments(read("src", "app", "signup", "teacher", "page.tsx"));
    assert.match(page, /JSON\.stringify\(\{ account: \{ email, password \}, details: submission\.details, cv: submission\.cv, introVideo: submission\.introVideo \}\)/);
    assert.equal(/localStorage|sessionStorage|role:|status:|uid:/.test(page), false);
    assert.match(page, /router\.push\(`\/verify-teacher\?email=\$\{encodeURIComponent\(email\.trim\(\)\)\}`\)/);
    assert.match(page, /response\.status === 409\) setProblem\(s\.emailInUse\)/);

    const route = stripComments(read("src", "app", "api", "signup", "teacher", "route.ts"));
    assert.match(route, /const account = \(body\.account \?\? \{\}\)/);
    assert.match(route, /parseApplicationDetails\(body\.details\)/);
    assert.match(route, /verifyUploadReference\("teacher_intro_video", body\.introVideo, otpSecret\)/);
    assert.equal(/body\.(uid|role|status)\b/.test(route), false, "identity and role never come from the request");
  });

  test("the form's fields are exactly the details the server accepts", () => {
    const form = read("src", "components", "academy", "workspace", "teacher", "application-form.tsx");
    const block = /export interface ApplicationDetailsInput \{([\s\S]*?)\n\}/.exec(form)?.[1] ?? "";
    const formKeys = [...block.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]).sort();
    const serverKeys = Object.keys(
      parseApplicationDetails({
        firstName: "A", lastName: "B", countryOfResidence: "TR", nationality: "EG", gender: "male",
        languages: [{ code: "ar", proficiency: "native" }], whatsapp: "+90 555 000 0000", telegram: "@teacher_a",
        bio: "x".repeat(60), socialLinks: [],
      }),
    ).sort();
    assert.deepEqual(formKeys, serverKeys);
    assert.match(form, /const BIO_MIN = 50;/);
    assert.match(read("src", "lib", "academy", "teachers", "applications.ts"), /export const BIO_MIN = 50;/);
  });
});

describe("the applicant's own application", () => {
  test("the route acts only for the session's account and accepts documents only with a server proof", () => {
    const route = stripComments(read("src", "app", "api", "academy", "teacher-application", "route.ts"));
    for (const method of ["GET", "POST", "PATCH"]) assert.match(route, new RegExp(`export const ${method} = withApi\\(async \\(req\\) => \\{\\s*const user = await requireAuth\\(req\\);`));
    assert.match(route, /verifyUploadReference\(purpose, value, secret\)/);
    assert.match(route, /if \(!secret\) throw new HttpError\(503/);
    assert.equal(/body\.(uid|role|status|applicantUid|cvPublicId)\b/.test(route), false);
  });

  test("the page shows the academy's note and offers revision only when the server allows it", () => {
    const page = stripComments(read("src", "app", "academy", "(workspace)", "teacher-application", "page.tsx"));
    assert.match(page, /useApi<TeacherApplicationView>\(api\.teacherApplication\)/);
    assert.match(page, /\{view\.canRevise && application && \(/);
    assert.match(page, /\{view\.canSubmit && \(/);
    assert.match(page, /\{application\.state === "approved" && view\.active && <LinkButton href=\{pages\.teach\}/);
    assert.equal(/localStorage|sessionStorage|accountRole|role ===/.test(page), false, "the page makes no access decision");
  });
});
