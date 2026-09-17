/**
 * Academy timestamps are rendered on the academy's clock, not the machine's.
 *
 * The workspace formatters used to leave `timeZone` undefined, so Intl fell
 * back to the runtime's own zone: the server rendered a session in the host's
 * zone (UTC in production) and the browser re-rendered it in the reader's,
 * which is both a wrong time and the text hydration mismatch class that
 * produced React error #418 on the signup page.
 *
 * There is one source for the zone — the `institution.timezone` policy, which
 * also decides the Lesson Sheet release week — resolved on the server and
 * handed to the client through the workspace provider.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { formatDate, formatDateTime, formatSessionTime } from "../../src/lib/academy/workspace/format.ts";

const ROOT = path.join(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const code = (rel: string) => read(rel).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const FORMAT = "src/lib/academy/workspace/format.ts";
const CONTEXT = "src/components/academy/workspace/context.tsx";
const WORKSPACE_LAYOUT = "src/app/academy/(workspace)/layout.tsx";
const SIGNUP_LAYOUT = "src/app/signup/teacher/layout.tsx";

const INSTANT = "2026-10-01T21:30:00.000Z";

// ---------------------------------------------------------------------------
// The runtime's zone cannot reach the output
// ---------------------------------------------------------------------------
describe("formatting is deterministic across runtimes", () => {
  test("the same instant and zone render identically whatever TZ the process runs in", () => {
    // Two processes standing in for the server and a reader's browser in
    // another part of the world. Only the environment differs.
    const script = `
      const { formatDateTime, formatSessionTime, formatDate } = await import(${JSON.stringify(
        new URL(`file://${path.join(ROOT, FORMAT).replace(/\\/g, "/")}`).href,
      )});
      const zone = "Asia/Riyadh";
      process.stdout.write(JSON.stringify([
        formatDateTime(${JSON.stringify(INSTANT)}, "en", zone),
        formatSessionTime(${JSON.stringify(INSTANT)}, "ar", zone),
        formatDate(${JSON.stringify(INSTANT)}, "tr", zone),
      ]));
    `;
    const run = (TZ: string) =>
      execFileSync(process.execPath, ["--input-type=module", "-e", script], {
        env: { ...process.env, TZ },
        encoding: "utf8",
      });
    const west = run("America/Los_Angeles");
    const east = run("Pacific/Auckland");
    assert.equal(west, east, "the host's zone must not change what a reader sees");
    assert.ok(JSON.parse(west).every((value: string) => value.length > 0), "the zone was applied, not dropped");
  });

  test("the academy's zone decides the text, so a different zone reads differently", () => {
    const riyadh = formatSessionTime(INSTANT, "en", "Asia/Riyadh");
    const london = formatSessionTime(INSTANT, "en", "Europe/London");
    assert.notEqual(riyadh, london);
    // 21:30 UTC is the next calendar day in Riyadh (+03) and the same day in London.
    assert.match(riyadh, /2 Oct 2026/);
    assert.match(london, /1 Oct 2026/);
    // Session times name their zone, so a reader elsewhere knows which clock this is.
    assert.match(riyadh, /GMT|UTC/);
  });

  test("an academy with no configured zone shows no time rather than the wrong one", () => {
    assert.equal(formatDateTime(INSTANT, "en", null), "");
    assert.equal(formatSessionTime(INSTANT, "ar", null), "");
    assert.equal(formatDate(INSTANT, "en", null), "", "an instant needs the academy's clock to name a day");
    // A plain calendar date carries no clock, so it still reads correctly.
    assert.match(formatDate("2026-10-01", "en", null), /1 Oct 2026/);
  });
});

// ---------------------------------------------------------------------------
// One source, resolved on the server
// ---------------------------------------------------------------------------
describe("the academy time zone has a single source", () => {
  test("no formatter can fall back to the runtime's zone", () => {
    const format = code(FORMAT);
    assert.doesNotMatch(format, /timeZone\?:/, "the zone is never optional");
    assert.doesNotMatch(format, /timeZone:\s*undefined/, "the zone is never dropped");
    // Every formatter that prints a clock takes the zone explicitly.
    for (const fn of ["formatDateTime", "formatSessionTime", "formatDate"]) {
      assert.match(format, new RegExp(`export function ${fn}\\([^)]*timeZone: string \\| null\\)`), fn);
    }
  });

  test("the display zone and the Lesson Sheet release rule read the same policy", () => {
    const lookup = code("src/lib/academy/services/policy-lookup.ts");
    assert.match(lookup, /academyTimeZone/);
    assert.match(lookup, /"institution\.timezone"/);
    // Display resolves through that same helper.
    const server = code("src/lib/academy/server.ts");
    assert.match(server, /export async function academyDisplayTimeZone\(\): Promise<string \| null>/);
    assert.match(server, /return await academyTimeZone\(academyExecutor\)/);
    // Scheduling keeps its own, stricter path: it must fail closed, not blank out.
    const sheets = code("src/lib/academy/services/lesson-sheet-service.ts");
    assert.match(sheets, /academyTimeZone\(executor\)/);
    assert.doesNotMatch(sheets, /academyDisplayTimeZone/);
  });

  test("the server resolves the zone and the client only renders what it was given", () => {
    const context = code(CONTEXT);
    // The provider takes the zone as a prop; nothing here asks the browser for one.
    assert.match(context, /readonly timeZone: string \| null;/);
    assert.match(context, /date: \(v\) => formatDate\(v, locale, timeZone\)/);
    assert.match(context, /dateTime: \(v\) => formatDateTime\(v, locale, timeZone\)/);
    assert.match(context, /sessionTime: \(v\) => formatSessionTime\(v, locale, timeZone\)/);
    assert.doesNotMatch(context, /resolvedOptions\(\)|Intl\.DateTimeFormat\(/, "the browser's own zone is never consulted");

    const workspace = code(WORKSPACE_LAYOUT);
    assert.match(workspace, /await academyDisplayTimeZone\(\)/, "the workspace resolves the academy zone on the server");
    assert.match(workspace, /timeZone=\{timeZone\}/);

    // The signup form shows no academy timestamps, so it passes none.
    assert.match(code(SIGNUP_LAYOUT), /timeZone=\{null\}/);
  });
});
