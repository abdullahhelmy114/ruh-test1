/**
 * Sign-up → verify → sign in must not answer a success with an error.
 *
 * Student sign-up happens entirely on the server (src/app/signup/student/page.tsx
 * never calls signInWithEmailAndPassword), so the browser holds no Firebase
 * session afterwards. /verify-email used to push the account home once the code
 * was accepted, which dropped the learner into the academy workspace with no
 * session: the workspace fetcher marks the state UNAUTHENTICATED and the shell
 * renders a red alert with a Sign in link. The first thing a new learner saw
 * after "Email Verified!" was an error.
 *
 * The teacher branch never had this problem: /verify-teacher sends the applicant
 * to /login. The shared page now does the same whenever the browser has no
 * session, and keeps the account home when it does.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const code = (rel: string) => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

describe("the account a verification creates is not asked to use a session it does not have", () => {
  test("student sign-up still does not sign the browser in, which is why the hand-off matters", () => {
    const signup = code("src/app/signup/student/page.tsx");
    assert.doesNotMatch(signup, /signInWithEmailAndPassword|signInWithPopup/, "sign-up runs on the server");
    assert.match(signup, /router\.push\(`?\/verify-email/);
  });

  test("a verified visitor with no session is sent to sign in, not into the workspace", () => {
    const verify = code("src/app/verify-email/page.tsx");
    assert.match(verify, /const \{ user \} = useAuth\(\);/, "the page knows whether this browser has a session");
    assert.match(verify, /router\.push\(user \? home : "\/login"\);/);
  });

  test("a visitor who does have a session still lands on the account home", () => {
    const verify = code("src/app/verify-email/page.tsx");
    assert.match(verify, /const home = localHome\(data\.home, "\/dashboard"\);/, "the server still names the destination");
    assert.match(verify, /user \? home/);
  });

  test("the teacher branch keeps the behaviour it already had", () => {
    assert.match(code("src/app/verify-teacher/page.tsx"), /router\.push\("\/login"\)/);
  });

  test("the success state is shown before either redirect", () => {
    const verify = code("src/app/verify-email/page.tsx");
    const success = verify.indexOf("setSuccess(true)");
    const redirect = verify.indexOf("router.push(user ? home");
    assert.ok(success !== -1 && redirect !== -1 && success < redirect, "the visitor sees the success first");
    assert.match(verify, /setTimeout\(/, "the redirect waits so the message can be read");
  });
});
