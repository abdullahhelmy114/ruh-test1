/**
 * The learner dashboard may not ship partial translation or invented state.
 *
 * The dashboard renders only through the workspace dictionary, so this test
 * walks the two source files for every `t.<section>.<key>` they reference and
 * asserts the path resolves to a non-empty string in English, Arabic and
 * Turkish. It also holds two content rules from the owner: the placement card
 * states its truthful unavailable status and offers no start action, and the
 * dictionary's dashboard section stays key-identical across the locales.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WORKSPACE_MESSAGES } from "../../src/lib/academy/workspace/messages.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const page = read("src/app/academy/(workspace)/learn/page.tsx");
const kit = read("src/components/academy/workspace/dashboard.tsx");
/** The student-facing surfaces this redesign touched; every t.* path they use must resolve everywhere. */
const SUBPAGES = [
  "src/components/academy/workspace/class-group/practice.tsx",
  "src/components/academy/workspace/class-group/readings-recordings.tsx",
  "src/app/academy/(workspace)/class-groups/[classGroupId]/lessons/[lessonId]/page.tsx",
  "src/app/academy/(workspace)/class-groups/[classGroupId]/content/[itemId]/page.tsx",
  "src/app/academy/(workspace)/recordings/[recordingId]/page.tsx",
  "src/app/academy/(workspace)/attempts/[attemptId]/page.tsx",
].map(read);
const source = [page, kit, ...SUBPAGES].join("\n");
const locales = ["en", "ar", "tr"] as const;

/** Every dictionary path the dashboard actually reads, straight from the source. */
const paths = [...new Set([...source.matchAll(/\bt\.([a-zA-Z]+(?:\.[a-zA-Z]+)+)/g)].map((m) => m[1]))]
  // Lookups like t.classGroup.sessionState[value] name the map, not a leaf.
  .filter((path) => !/\.(sessionState|status|enrollment|prepStatus)$/.test(path) || false);

function resolve(locale: (typeof locales)[number], path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => {
    if (node === null || typeof node !== "object") return undefined;
    return (node as Record<string, unknown>)[key];
  }, WORKSPACE_MESSAGES[locale]);
}

describe("learner dashboard translation completeness", () => {
  test("the dashboard references a meaningful number of dictionary paths", () => {
    assert.ok(paths.length >= 30, `found ${paths.length} referenced paths`);
  });

  for (const locale of locales) {
    test(`${locale}: every referenced dictionary path resolves`, () => {
      const missing = paths.filter((path) => {
        const value = resolve(locale, path);
        if (typeof value === "string") return value.trim() === "";
        // Maps used for status lookups must be objects of non-empty strings.
        if (value !== null && typeof value === "object") {
          return Object.values(value).some((entry) => typeof entry === "string" && entry.trim() === "");
        }
        return true;
      });
      assert.deepEqual(missing, []);
    });
  }

  test("the dashboard section is key-identical across the locales", () => {
    const shape = (value: unknown): string =>
      JSON.stringify(
        Object.entries(value as Record<string, unknown>)
          .map(([key, entry]) => [key, typeof entry === "object" ? shape(entry) : "s"] as const)
          .sort((a, b) => a[0].localeCompare(b[0])),
      );
    const en = shape(WORKSPACE_MESSAGES.en.dashboard);
    assert.equal(shape(WORKSPACE_MESSAGES.ar.dashboard), en, "ar");
    assert.equal(shape(WORKSPACE_MESSAGES.tr.dashboard), en, "tr");
  });
});

describe("learner dashboard truthfulness", () => {
  test("the placement card states its unavailable status and offers no start action", () => {
    const section = page.slice(page.indexOf("t.dashboard.placement}"), page.indexOf("</DashboardCard>", page.indexOf("t.dashboard.placement}")));
    assert.ok(section.includes("placementUnavailable"), "the truthful status is rendered");
    assert.ok(!/LinkButton|<Button|href=/.test(section), "no start button or link inside the placement card");
  });

  test("no hardcoded progress value reaches the progress bar", () => {
    // The only ProgressBar value is computed from the live progress API.
    assert.match(page, /ProgressBar\s*\n?\s*value=\{lessons\.completed \/ lessons\.total\}/);
    assert.doesNotMatch(source, /value=\{0\.\d+\}/, "no literal ratio is rendered");
  });

  test("the referral card links to the real referral center", () => {
    assert.match(page, /href="\/affiliate"/);
  });

  test("student surfaces localize enum values instead of leaking them", () => {
    const [practice, readingsRecordings, , contentPage, recordingPage, attemptPage] = SUBPAGES;
    assert.match(practice, /contentKind\[row\.kind/, "practice tiles localize the content kind");
    assert.match(practice, /contentPurpose\[row\.purpose/, "practice tiles localize the purpose");
    assert.doesNotMatch(practice, /<Badge>\{row\.kind\}<\/Badge>/, "no raw kind badge remains");
    assert.match(readingsRecordings, /t\.recordings\.state\[row\.state/, "recording rows localize the state");
    assert.match(recordingPage, /t\.recordings\.state\[recording\.state/, "the recording page localizes the state");
    assert.match(contentPage, /contentKind\[opened\.item\.kind/, "the content page localizes the kind");
    assert.match(attemptPage, /\{ id: index \+ 1 \}/, "result items are numbered, not raw ids");
  });

  test("the vocabulary table can scroll instead of overflowing narrow screens", () => {
    const lessonPage = SUBPAGES[2];
    assert.match(lessonPage, /overflow-x-auto[^"]*"[\s\S]{0,80}<table/, "the vocabulary table sits in an overflow wrapper");
  });
});
