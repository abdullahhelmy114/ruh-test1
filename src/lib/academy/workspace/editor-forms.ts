/**
 * Editor form models for the administration authoring screens.
 *
 * Structured content (Lesson Script blocks, assessment items) is edited as
 * simple text fields and converted back to the exact input the server's
 * parsers accept. Pure functions, so a round trip through an editor can be
 * checked against those parsers in tests. The server validates everything
 * again; nothing here decides what is valid.
 */
import type { AssessmentContent, AssessmentItem, ItemType } from "../assessment/content.ts";
import type { BlockType, LessonBlock, LessonContent } from "../lessons/content.ts";

const lines = (value: string): string[] =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");

const cells = (line: string): string[] => line.split("|").map((cell) => cell.trim());

const optional = (value: string): string | null => (value.trim() === "" ? null : value.trim());

// ---------------------------------------------------------------------------
// Lesson Script blocks
// ---------------------------------------------------------------------------

export interface BlockForm {
  /** Kept for existing blocks so learners' annotations stay anchored; empty for new blocks. */
  readonly id: string;
  readonly type: BlockType;
  readonly level: string;
  readonly text: string;
  readonly translation: string;
  readonly lines: string;
  readonly ordered: boolean;
  readonly prompt: string;
  readonly url: string;
  readonly title: string;
  readonly alt: string;
  readonly caption: string;
  readonly transcript: string;
}

export function emptyBlockForm(type: BlockType): BlockForm {
  return { id: "", type, level: "2", text: "", translation: "", lines: "", ordered: false, prompt: "", url: "", title: "", alt: "", caption: "", transcript: "" };
}

export function blockToForm(block: LessonBlock): BlockForm {
  const base = { ...emptyBlockForm(block.type), id: block.id };
  switch (block.type) {
    case "heading":
      return { ...base, level: String(block.level), text: block.text };
    case "paragraph":
    case "teacher_note":
      return { ...base, text: block.text };
    case "arabic_text":
    case "example":
      return { ...base, text: block.text, translation: block.translation ?? "" };
    case "list":
      return { ...base, lines: block.items.join("\n"), ordered: block.ordered };
    case "vocabulary":
      return { ...base, lines: block.entries.map((e) => [e.term, e.meaning, e.note ?? ""].join(" | ").replace(/ \| $/, "")).join("\n") };
    case "exercise":
      return {
        ...base,
        prompt: block.prompt,
        lines: block.questions
          .map((q) => {
            const correct = q.correctOptionId === null ? "" : String(q.options.findIndex((o) => o.id === q.correctOptionId) + 1);
            return [q.question, q.options.map((o) => o.text).join("; "), correct, q.explanation ?? ""].join(" | ").replace(/( \| )+$/, "");
          })
          .join("\n"),
      };
    case "audio":
      return { ...base, title: block.title, url: block.url, transcript: block.transcript ?? "" };
    case "image":
      return { ...base, url: block.url, alt: block.alt, caption: block.caption ?? "" };
    case "divider":
      return base;
  }
}

/** The parser input for one block. Unknown or incomplete fields are left for the server to reject with a clear message. */
export function formToBlockInput(form: BlockForm): Record<string, unknown> {
  const id = form.id ? { id: form.id } : {};
  switch (form.type) {
    case "heading":
      return { ...id, type: "heading", level: Number(form.level), text: form.text };
    case "paragraph":
    case "teacher_note":
      return { ...id, type: form.type, text: form.text };
    case "arabic_text":
    case "example":
      return { ...id, type: form.type, text: form.text, translation: optional(form.translation) };
    case "list":
      return { ...id, type: "list", ordered: form.ordered, items: lines(form.lines) };
    case "vocabulary":
      return {
        ...id,
        type: "vocabulary",
        entries: lines(form.lines).map((line) => {
          const [term = "", meaning = "", note = ""] = cells(line);
          return { term, meaning, note: optional(note) };
        }),
      };
    case "exercise":
      return {
        ...id,
        type: "exercise",
        prompt: form.prompt,
        questions: lines(form.lines).map((line) => {
          const [question = "", optionText = "", correct = "", explanation = ""] = cells(line);
          const options = optionText
            .split(";")
            .map((o) => o.trim())
            .filter((o) => o !== "")
            .map((text, index) => ({ id: `o${index + 1}`, text }));
          const correctNumber = Number(correct);
          return {
            question,
            options,
            correctOptionId: Number.isInteger(correctNumber) && correctNumber >= 1 && correctNumber <= options.length ? `o${correctNumber}` : null,
            explanation: optional(explanation),
          };
        }),
      };
    case "audio":
      return { ...id, type: "audio", title: form.title, url: form.url, transcript: optional(form.transcript) };
    case "image":
      return { ...id, type: "image", url: form.url, alt: form.alt, caption: optional(form.caption) };
    case "divider":
      return { ...id, type: "divider" };
  }
}

export function lessonContentToForms(content: LessonContent): BlockForm[] {
  return content.blocks.map(blockToForm);
}

export function formsToLessonInput(forms: readonly BlockForm[]): { blocks: Record<string, unknown>[] } {
  return { blocks: forms.map(formToBlockInput) };
}

// ---------------------------------------------------------------------------
// Assessment items
// ---------------------------------------------------------------------------

export interface ItemForm {
  readonly id: string;
  readonly type: ItemType;
  readonly prompt: string;
  readonly points: string;
  readonly options: string;
  readonly correctNumber: string;
  readonly correctTrue: boolean;
  readonly accepted: string;
  readonly order: string;
  readonly pairs: string;
  readonly audioUrl: string;
  readonly maxLength: string;
  readonly maxWords: string;
  readonly maxSeconds: string;
  readonly rubric: string;
}

export function emptyItemForm(type: ItemType, id: string): ItemForm {
  return { id, type, prompt: "", points: "1", options: "", correctNumber: "1", correctTrue: true, accepted: "", order: "", pairs: "", audioUrl: "", maxLength: "500", maxWords: "", maxSeconds: "60", rubric: "" };
}

export function itemToForm(item: AssessmentItem): ItemForm {
  const base = { ...emptyItemForm(item.type, item.id), prompt: item.prompt, points: String(item.points) };
  switch (item.type) {
    case "choice":
      return { ...base, options: item.options.join("\n"), correctNumber: String(item.correctIndex + 1) };
    case "listening":
      return { ...base, options: item.options.join("\n"), correctNumber: String(item.correctIndex + 1), audioUrl: item.audioUrl };
    case "true_false":
      return { ...base, correctTrue: item.correct };
    case "fill_blank":
      return { ...base, accepted: item.acceptedAnswers.join("\n") };
    case "word_order":
      return { ...base, order: item.correctOrder.join("\n") };
    case "matching":
      return { ...base, pairs: item.pairs.map((p) => `${p.left} | ${p.right}`).join("\n") };
    case "short_text":
      return { ...base, accepted: (item.acceptedAnswers ?? []).join("\n"), maxLength: String(item.maxLength) };
    case "essay":
      return { ...base, maxWords: item.maxWords === null ? "" : String(item.maxWords), rubric: item.rubric ?? "" };
    case "oral_response":
      return { ...base, maxSeconds: String(item.maxSeconds), rubric: item.rubric ?? "" };
  }
}

const whole = (value: string): number | string => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : value);

export function formToItemInput(form: ItemForm): Record<string, unknown> {
  const base = { id: form.id.trim(), type: form.type, prompt: form.prompt, points: whole(form.points) };
  switch (form.type) {
    case "choice":
      return { ...base, options: lines(form.options), correctIndex: Number(form.correctNumber) - 1 };
    case "listening":
      return { ...base, audioUrl: form.audioUrl.trim(), options: lines(form.options), correctIndex: Number(form.correctNumber) - 1 };
    case "true_false":
      return { ...base, correct: form.correctTrue };
    case "fill_blank":
      return { ...base, acceptedAnswers: lines(form.accepted) };
    case "word_order":
      return { ...base, correctOrder: lines(form.order) };
    case "matching":
      return {
        ...base,
        pairs: lines(form.pairs).map((line) => {
          const [left = "", right = ""] = cells(line);
          return { left, right };
        }),
      };
    case "short_text": {
      const accepted = lines(form.accepted);
      return { ...base, acceptedAnswers: accepted.length === 0 ? null : accepted, maxLength: whole(form.maxLength) };
    }
    case "essay":
      return { ...base, maxWords: form.maxWords.trim() === "" ? null : whole(form.maxWords), rubric: optional(form.rubric) };
    case "oral_response":
      return { ...base, maxSeconds: whole(form.maxSeconds), rubric: optional(form.rubric) };
  }
}

export function assessmentContentToForms(content: AssessmentContent): { instructions: string; items: ItemForm[] } {
  return { instructions: content.instructions ?? "", items: content.items.map(itemToForm) };
}

export function formsToAssessmentInput(instructions: string, items: readonly ItemForm[]): { instructions: string | null; items: Record<string, unknown>[] } {
  return { instructions: optional(instructions), items: items.map(formToItemInput) };
}

/** A new item id that does not collide with existing ones (q1, q2, ...). */
export function nextItemId(items: readonly { readonly id: string }[]): string {
  const taken = new Set(items.map((item) => item.id));
  let n = items.length + 1;
  while (taken.has(`q${n}`)) n++;
  return `q${n}`;
}

// ---------------------------------------------------------------------------
// Curriculum outline
// ---------------------------------------------------------------------------

export interface OutlineLessonForm {
  readonly key: string;
  readonly lessonId: string | null;
  readonly title: string;
  readonly summary: string;
  readonly plannedMinutes: string;
}

export interface OutlineUnitForm {
  readonly key: string;
  readonly unitId: string | null;
  readonly title: string;
  readonly summary: string;
  readonly lessons: readonly OutlineLessonForm[];
}

export function outlineToForms(outline: {
  readonly units: readonly {
    readonly unitId: string;
    readonly title: string;
    readonly summary: string | null;
    readonly lessons: readonly { readonly lessonId: string; readonly title: string; readonly summary: string | null; readonly plannedMinutes: number | null }[];
  }[];
}): OutlineUnitForm[] {
  return outline.units.map((unit) => ({
    key: unit.unitId,
    unitId: unit.unitId,
    title: unit.title,
    summary: unit.summary ?? "",
    lessons: unit.lessons.map((lesson) => ({
      key: lesson.lessonId,
      lessonId: lesson.lessonId,
      title: lesson.title,
      summary: lesson.summary ?? "",
      plannedMinutes: lesson.plannedMinutes === null ? "" : String(lesson.plannedMinutes),
    })),
  }));
}

export function formsToOutlineInput(units: readonly OutlineUnitForm[]): { units: Record<string, unknown>[] } {
  return {
    units: units.map((unit) => ({
      unitId: unit.unitId,
      title: unit.title,
      summary: optional(unit.summary),
      lessons: unit.lessons.map((lesson) => ({
        lessonId: lesson.lessonId,
        title: lesson.title,
        summary: optional(lesson.summary),
        plannedMinutes: lesson.plannedMinutes.trim() === "" ? null : whole(lesson.plannedMinutes),
      })),
    })),
  };
}

/** Moves an element within a list; out-of-range moves return the list unchanged. */
export function move<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
