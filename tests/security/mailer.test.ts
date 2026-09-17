/**
 * Outgoing mail fails closed, and says so.
 *
 * A real teacher signup issued a verification code that never arrived:
 * smtp.gmail.com answered 535-5.7.8 ("Username and Password not accepted")
 * because the configured App Password no longer authenticated. The routes
 * behaved correctly - the send threw and none of them claimed the code had
 * been delivered - so these tests pin that contract, and the configuration
 * the transport needs, rather than the credentials themselves.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const SRC = path.join(import.meta.dirname, "..", "..", "src");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const code = (rel: string) => read(rel).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const MAILER = "lib/email.ts";

describe("the mailer", () => {
  test("refuses to send unless the whole transport is configured", () => {
    const mailer = code(MAILER);
    // All three, not two: a missing sender address produced "<undefined>" in
    // the From header and the server refused the message at the end.
    for (const name of ["EMAIL_USER", "EMAIL_PASS", "EMAIL_FROM"]) {
      assert.ok(mailer.includes(`process.env.${name}`), `${name} must be read`);
      assert.match(mailer, new RegExp(`!process\\.env\\.${name}`), `${name} must be required before sending`);
    }
    assert.match(mailer, /throw new Error\("Email credentials not configured"\)/);
    // The guard runs before the send, not after it.
    const guard = mailer.indexOf("Email credentials not configured");
    const send = mailer.indexOf("transporter.sendMail");
    assert.ok(guard > 0 && send > guard, "the configuration check comes first");
  });

  test("the configuration it needs is documented where it is used", () => {
    const documentation = read(MAILER);
    for (const name of ["EMAIL_USER", "EMAIL_PASS", "EMAIL_FROM"]) {
      assert.ok(documentation.includes(name), name);
    }
    assert.match(documentation, /App Password/i, "the Gmail requirement is stated");
    assert.match(documentation, /535-5\.7\.8/, "the failure it produces is named, so the next report is recognisable");
  });

  test("no caller treats a failed send as a delivered one", () => {
    // Every route that sends a verification code must let the failure show:
    // either it propagates, or it is caught and answered with an error.
    for (const route of [
      "app/api/send-verification-code/route.ts",
      "app/api/signup/teacher/route.ts",
      "app/api/signup/student/route.ts",
    ]) {
      const source = code(route);
      assert.ok(source.includes("sendEmail("), `${route} sends the code`);
      const caught = /catch\s*\(/.test(source);
      assert.ok(caught, `${route} handles a failed send`);
      // None of them may mark the address verified or claim delivery.
      assert.doesNotMatch(source, /email_verified\s*=\s*true|emailVerified:\s*true/, `${route} must not verify an address it could not mail`);
    }
  });

  test("the generated code is never written to a log", () => {
    // By identifier, not by the word: a message may say "verification code",
    // but the value returned by generateOtp() must never reach a log line.
    for (const route of [
      "app/api/send-verification-code/route.ts",
      "app/api/signup/teacher/route.ts",
      "app/api/signup/student/route.ts",
    ]) {
      const source = code(route);
      const assigned = [...source.matchAll(/const (\w+) = generateOtp\(\)/g)].map((match) => match[1]);
      assert.equal(assigned.length, 1, `${route} issues exactly one code`);
      const secrets = [...assigned, "digest", "emailCode", "otp"];
      const calls = source.split("console.").slice(1).map((chunk) => chunk.slice(0, chunk.indexOf(");") + 1));
      for (const call of calls) {
        for (const name of secrets) {
          assert.equal(call.includes(`, ${name}`), false, `${route} may not log ${name}`);
          assert.equal(call.includes(`(${name}`), false, `${route} may not log ${name}`);
          assert.equal(call.includes(`{${name}}`), false, `${route} may not interpolate ${name}`);
        }
      }
      // Nor may it travel anywhere but the mail body and the digest.
      assert.equal(source.includes(`JSON.stringify(${assigned[0]})`), false, `${route} may not serialise the code`);
    }
  });
});
