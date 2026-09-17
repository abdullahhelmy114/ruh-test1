/**
 * The academy administration screens.
 *
 * The administrator role is enforced by every /api/admin/academy endpoint;
 * these tests cover what the screens themselves must get right: complete
 * text in every locale, editors that round-trip content exactly through the
 * server's own parsers (so saving never corrupts or silently changes a
 * Lesson Script, an assessment or an outline), review commands consistent
 * with the governed version state machine, valid 2C starting structures,
 * and API use limited to the administrator and academy endpoints.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseAssessmentContent, type AssessmentContent } from "../../src/lib/academy/assessment/content.ts";
import { PRODUCT_LOCALES } from "../../src/lib/academy/domain/vocabulary.ts";
import { CONTENT_VERSION_MACHINE, CONTENT_VERSION_STATES, canTransition } from "../../src/lib/academy/domain/states.ts";
import { parseLessonContent, type LessonContent } from "../../src/lib/academy/lessons/content.ts";
import { CONTENT_KINDS, parseProductionContent } from "../../src/lib/academy/production/content.ts";
import { ADMIN_MESSAGES } from "../../src/lib/academy/workspace/admin-messages.ts";
import { CONTENT_TEMPLATES } from "../../src/lib/academy/workspace/content-templates.ts";
import {
  assessmentContentToForms,
  blockToForm,
  emptyBlockForm,
  formsToAssessmentInput,
  formsToLessonInput,
  formsToOutlineInput,
  formToBlockInput,
  lessonContentToForms,
  move,
  nextItemId,
  outlineToForms,
} from "../../src/lib/academy/workspace/editor-forms.ts";
import { COMMAND_TARGET, COMMANDS_BY_STATE, REASON_REQUIRED } from "../../src/lib/academy/workspace/review-commands.ts";

const ROOT = join(import.meta.dirname, "..", "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

type Tree = { readonly [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of leaves(value, path)) out.set(k, v);
  }
  return out;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("administration text", () => {
  test("every locale has the English keys, non-empty text and the same placeholders", () => {
    const reference = leaves(ADMIN_MESSAGES.en as unknown as Tree);
    assert.ok(reference.size >= 350, `only ${reference.size} strings`);
    for (const locale of PRODUCT_LOCALES) {
      const translated = leaves(ADMIN_MESSAGES[locale] as unknown as Tree);
      assert.deepEqual([...translated.keys()].sort(), [...reference.keys()].sort(), locale);
      for (const [key, text] of translated) {
        assert.ok(text.trim().length > 0, `${locale}.${key} is empty`);
        assert.deepEqual(placeholders(text), placeholders(reference.get(key) as string), `${locale}.${key}`);
      }
      if (locale !== "en") {
        const same = [...translated].filter(([key, text]) => text === reference.get(key) && /[a-z]{5,}/i.test(text));
        assert.ok(same.length / translated.size < 0.03, `${locale}: ${same.map(([k]) => k).slice(0, 5).join(", ")}`);
      }
    }
  });

  test("the policy screen states there is no class-group level, in every locale", () => {
    assert.match(ADMIN_MESSAGES.en.policies.intro, /no class group level/i);
    for (const locale of PRODUCT_LOCALES) assert.ok(ADMIN_MESSAGES[locale].policies.intro.length > 20);
  });
});

const B = (n: number) => `b0000000-0000-4000-8000-00000000000${n}`;

const LESSON: LessonContent = parseLessonContent({
  blocks: [
    { id: B(1), type: "heading", level: 2, text: "الجملة الاسمية" },
    { id: B(2), type: "paragraph", text: "A nominal sentence starts with a noun.\nIt has two parts." },
    { id: B(3), type: "arabic_text", text: "الكتابُ جديدٌ", translation: "The book is new." },
    { id: B(4), type: "list", ordered: true, items: ["Mubtada", "Khabar"] },
    { id: B(5), type: "vocabulary", entries: [{ term: "كتاب", meaning: "book", note: "masculine" }, { term: "قلم", meaning: "pen", note: null }] },
    { id: B(6), type: "example", text: "البيتُ كبيرٌ", translation: null },
    {
      id: B(7),
      type: "exercise",
      prompt: "Choose the predicate",
      questions: [
        { id: "q1", question: "الكتابُ ___", options: [{ id: "o1", text: "جديدٌ" }, { id: "o2", text: "في" }], correctOptionId: "o1", explanation: "The predicate completes the meaning." },
        { id: "q2", question: "القلمُ ___", options: [{ id: "o1", text: "على" }, { id: "o2", text: "طويلٌ" }, { id: "o3", text: "من" }], correctOptionId: null, explanation: null },
      ],
    },
    { id: B(8), type: "audio", title: "Listen", url: "https://audio.example.test/a.mp3", transcript: null },
    { id: B(9), type: "image", url: "https://img.example.test/a.png", alt: "A book on a desk", caption: "Figure 1" },
    { id: "b0000000-0000-4000-8000-000000000010", type: "teacher_note", text: "Ask learners to find more examples." },
    { id: "b0000000-0000-4000-8000-000000000011", type: "divider" },
  ],
});

const ASSESSMENT: AssessmentContent = parseAssessmentContent({
  instructions: "Answer every question.",
  items: [
    { id: "q1", type: "choice", prompt: "Which word means book?", options: ["قلم", "كتاب", "باب"], correctIndex: 1, points: 2 },
    { id: "q2", type: "true_false", prompt: "الكتاب is masculine.", correct: false },
    { id: "q3", type: "fill_blank", prompt: "Transliterate كتاب", acceptedAnswers: ["kitaab", "kitab"] },
    { id: "q4", type: "word_order", prompt: "Order", correctOrder: ["ذهب", "الولد", "إلى", "المدرسة"] },
    { id: "q5", type: "matching", prompt: "Match", pairs: [{ left: "كتاب", right: "book" }, { left: "قلم", right: "pen" }] },
    { id: "q6", type: "listening", prompt: "Listen and choose", audioUrl: "https://audio.example.test/q6.mp3", options: ["one", "two"], correctIndex: 0 },
    { id: "q7", type: "short_text", prompt: "Say hello", acceptedAnswers: null, maxLength: 120 },
    { id: "q8", type: "short_text", prompt: "Plural of كتاب", acceptedAnswers: ["كتب"], maxLength: 50 },
    { id: "q9", type: "essay", prompt: "Describe your school.", maxWords: 200, rubric: "Grammar and vocabulary", points: 10 },
    { id: "q10", type: "essay", prompt: "Free writing", maxWords: null, rubric: null },
    { id: "q11", type: "oral_response", prompt: "Read aloud", maxSeconds: 90, rubric: "Pronunciation" },
  ],
});

describe("authoring editors round-trip through the server's parsers", () => {
  test("a Lesson Script with every block type survives editing unchanged, keeping block ids", () => {
    const forms = lessonContentToForms(LESSON);
    const reparsed = parseLessonContent(formsToLessonInput(forms), () => {
      throw new Error("an existing block lost its id");
    });
    assert.deepEqual(reparsed, LESSON);
  });

  test("new blocks get ids from the server, and an exercise answer number maps to its option", () => {
    const input = formToBlockInput({ ...emptyBlockForm("exercise"), prompt: "Pick", lines: "Q | a; b; c | 3 | because" });
    assert.equal("id" in input, false);
    let n = 0;
    const parsed = parseLessonContent({ blocks: [input] }, () => `c0000000-0000-4000-8000-00000000000${++n}`);
    const block = parsed.blocks[0];
    assert.ok(block.type === "exercise");
    assert.equal(block.questions[0].correctOptionId, "o3");
    assert.equal(blockToForm(block).lines, "Q | a; b; c | 3 | because");
  });

  test("an assessment with every item type survives editing unchanged", () => {
    const forms = assessmentContentToForms(ASSESSMENT);
    assert.deepEqual(parseAssessmentContent(formsToAssessmentInput(forms.instructions, forms.items)), ASSESSMENT);
  });

  test("editor input carries only fields the parsers accept (unknown fields are rejected)", () => {
    const forms = assessmentContentToForms(ASSESSMENT);
    const input = formsToAssessmentInput(forms.instructions, forms.items);
    assert.doesNotThrow(() => parseAssessmentContent(input));
    assert.throws(() => parseAssessmentContent({ ...input, items: [{ ...input.items[0], hint: "x" }] }));
  });

  test("outlines keep unit and lesson ids and send new ones as null", () => {
    const outline = {
      units: [
        {
          unitId: "d0000000-0000-4000-8000-000000000001",
          title: "Sentences",
          summary: null,
          lessons: [{ lessonId: "e0000000-0000-4000-8000-000000000001", title: "Nominal", summary: "Basics", plannedMinutes: 60 }],
        },
      ],
    };
    const forms = outlineToForms(outline);
    const withNew = [{ ...forms[0], lessons: [...forms[0].lessons, { key: "new", lessonId: null, title: "Verbal", summary: "", plannedMinutes: "" }] }];
    assert.deepEqual(formsToOutlineInput(withNew), {
      units: [
        {
          unitId: "d0000000-0000-4000-8000-000000000001",
          title: "Sentences",
          summary: null,
          lessons: [
            { lessonId: "e0000000-0000-4000-8000-000000000001", title: "Nominal", summary: "Basics", plannedMinutes: 60 },
            { lessonId: null, title: "Verbal", summary: null, plannedMinutes: null },
          ],
        },
      ],
    });
  });

  test("helpers: stable reordering and non-colliding item ids", () => {
    assert.deepEqual(move(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
    assert.deepEqual(move(["a", "b"], 1, 5), ["a", "b"]);
    assert.equal(nextItemId([{ id: "q1" }, { id: "q2" }, { id: "q3" }]), "q4");
    assert.equal(nextItemId([{ id: "q2" }]), "q3");
  });
});

describe("review commands", () => {
  test("every offered command is a transition the governed version state machine allows", () => {
    let checked = 0;
    for (const state of CONTENT_VERSION_STATES) {
      for (const command of COMMANDS_BY_STATE[state]) {
        checked++;
        assert.ok(canTransition(CONTENT_VERSION_MACHINE, state, COMMAND_TARGET[command]), `${state} → ${command}`);
      }
    }
    assert.ok(checked >= 10);
  });

  test("every allowed transition out of a state is offered, so no reachable state is a dead end in the UI", () => {
    for (const state of CONTENT_VERSION_STATES) {
      const offered = new Set(COMMANDS_BY_STATE[state].map((command) => COMMAND_TARGET[command]));
      for (const target of CONTENT_VERSION_MACHINE.transitions[state]) {
        // Supersession happens only through publishing another version.
        if (target === "superseded") continue;
        assert.ok(offered.has(target), `${state} → ${target} is not offered`);
      }
    }
  });

  test("destructive and blocking commands ask for a reason", () => {
    for (const command of ["request_changes", "reject", "unapprove", "archive"] as const) assert.ok(REASON_REQUIRED.includes(command));
    assert.equal(REASON_REQUIRED.includes("publish"), false);
  });
});

describe("2C starting structures", () => {
  test("each content kind has an example that the server's parser accepts", () => {
    for (const kind of CONTENT_KINDS) {
      assert.doesNotThrow(() => parseProductionContent(kind, CONTENT_TEMPLATES[kind]), kind);
    }
  });
});

describe("administration screens", () => {
  const pageDir = join(ROOT, "src", "app", "academy", "(workspace)", "manage");
  const componentDir = join(ROOT, "src", "components", "academy", "workspace", "admin");
  const pages = walk(pageDir).filter((path) => path.endsWith("page.tsx"));
  const files = [...walk(pageDir), ...walk(componentDir)].filter((path) => /\.tsx?$/.test(path));
  const rel = (path: string) => relative(pageDir, path).replace(/\\/g, "/");

  test("every administration area has a screen", () => {
    const routes = pages.map((path) => rel(path).replace(/\/?page\.tsx$/, "")).sort();
    for (const route of [
      "",
      "catalog",
      "programs/[programId]",
      "courses/[courseId]",
      "curriculum-versions/[versionId]",
      "lessons/[lessonId]",
      "lesson-script-versions/[versionId]",
      "assessments/[assessmentId]",
      "assessment-versions/[versionId]",
      "class-groups",
      "class-groups/[classGroupId]",
      "policies",
      "approval-gates",
      "review-queue",
      "audit",
      "announcements",
      "production",
      "production/items/[itemId]",
      "production/versions/[versionId]",
    ]) {
      assert.ok(routes.includes(route), `missing administration screen: /academy/manage/${route}`);
    }
  });

  test("administration screens call only administrator and academy endpoints", () => {
    const paths = readFileSync(join(componentDir, "api-paths.ts"), "utf8");
    const bases = [...paths.matchAll(/`(\/api\/[^`$?]*)|"(\/api\/[^"]+)"/g)].map((m) => m[1] ?? m[2]);
    assert.deepEqual(bases.sort(), ["/api/admin/academy", "/api/admin/users"], "only the administrator base and the people directory are literal");
    assert.match(paths, /const A = "\/api\/admin\/academy";/);
    // Every other path is built on that base.
    assert.ok([...paths.matchAll(/`\$\{A\}\//g)].length >= 40, "the administrator paths are expected to be built from the base");
    for (const path of files) {
      const src = readFileSync(path, "utf8");
      for (const literal of src.matchAll(/["'`](\/api\/[^"'`$]*)/g)) {
        assert.match(literal[1], /^\/api\/(admin\/academy|admin\/users$|academy\/)/, `${rel(path)} calls ${literal[1]}`);
      }
      assert.doesNotMatch(src, /\bfetch\(|authFetch|localStorage|sessionStorage|dangerouslySetInnerHTML/, rel(path));
      assert.doesNotMatch(src, /import (?!type)[^;]*from "@\/lib\/academy\/(services|repo)\//, rel(path));
      assert.doesNotMatch(src, /@\/lib\/academy\/server|@\/lib\/db\/client/, rel(path));
    }
  });

  test("administration pages are client pages that export only their default component", () => {
    for (const path of pages) {
      const src = readFileSync(path, "utf8");
      assert.match(src, /^"use client";/, rel(path));
      const exported = [...src.matchAll(/^export (?!default)(?:const|function|type|interface) (\w+)/gm)].map((m) => m[1]);
      assert.deepEqual(exported, [], `${rel(path)} exports ${exported.join(", ")}`);
    }
  });
});
