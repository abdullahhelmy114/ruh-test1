"use client";

import type { LearnerItem } from "@/lib/academy/assessment/content";
import { useWorkspace } from "./context";
import { Button, Field, SelectInput, TextArea, TextInput } from "./ui";

/** A learner's answer to one item, in the shape the server's response parser accepts. */
export type ItemAnswer =
  | { readonly optionIndex: number }
  | { readonly value: boolean }
  | { readonly text: string }
  | { readonly tokens: readonly string[] }
  | { readonly pairs: readonly { readonly left: string; readonly right: string }[] }
  | { readonly audioUrl: string };

export type AnswerMap = Readonly<Record<string, ItemAnswer>>;

/** Converts stored responses ({ itemId: response }) into the editor's map. */
export function answersFromResponses(responses: unknown): AnswerMap {
  if (!responses || typeof responses !== "object") return {};
  const out: Record<string, ItemAnswer> = {};
  for (const [itemId, value] of Object.entries(responses as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const { itemId: _ignored, ...answer } = value as Record<string, unknown>;
    void _ignored;
    out[itemId] = answer as ItemAnswer;
  }
  return out;
}

/** Converts the editor's map into the list the API expects, leaving out unanswered and incomplete items. */
export function responsesFromAnswers(items: readonly LearnerItem[], answers: AnswerMap): { itemId: string }[] {
  return items.flatMap((item) => {
    const answer = answers[item.id];
    if (!answer) return [];
    if ("text" in answer && answer.text.trim() === "") return [];
    if ("audioUrl" in answer && answer.audioUrl.trim() === "") return [];
    if ("pairs" in answer && item.type === "matching" && answer.pairs.some((p) => !p.right)) return [];
    return [{ itemId: item.id, ...answer }];
  });
}

/** Renders one item's input. Only answer-free item projections reach this component. */
export function ItemInput({
  item,
  answer,
  onChange,
  disabled,
}: {
  readonly item: LearnerItem;
  readonly answer: ItemAnswer | undefined;
  readonly onChange: (answer: ItemAnswer) => void;
  readonly disabled?: boolean;
}) {
  const { t, fmt } = useWorkspace();
  const name = `item-${item.id}`;

  switch (item.type) {
    case "choice":
    case "listening":
      return (
        <fieldset disabled={disabled}>
          <legend className="sr-only">{item.prompt}</legend>
          {item.type === "listening" && <audio controls preload="none" src={item.audioUrl} className="mb-2 w-full" />}
          <div className="space-y-1">
            {item.options.map((option, index) => (
              <label key={index} className="flex items-center gap-2">
                <input type="radio" name={name} checked={answer !== undefined && "optionIndex" in answer && answer.optionIndex === index} onChange={() => onChange({ optionIndex: index })} />
                <span dir="auto">{option}</span>
              </label>
            ))}
          </div>
        </fieldset>
      );
    case "true_false":
      return (
        <fieldset disabled={disabled} className="flex gap-4">
          <legend className="sr-only">{item.prompt}</legend>
          {[true, false].map((value) => (
            <label key={String(value)} className="flex items-center gap-2">
              <input type="radio" name={name} checked={answer !== undefined && "value" in answer && answer.value === value} onChange={() => onChange({ value })} />
              {value ? t.assessment.true : t.assessment.false}
            </label>
          ))}
        </fieldset>
      );
    case "fill_blank":
    case "short_text":
      return (
        <Field label={t.assessment.answer} htmlFor={name}>
          <TextInput
            id={name}
            dir="auto"
            disabled={disabled}
            maxLength={item.type === "short_text" ? item.maxLength : 500}
            value={answer && "text" in answer ? answer.text : ""}
            onChange={(e) => onChange({ text: e.target.value })}
          />
        </Field>
      );
    case "essay":
      return (
        <Field label={t.assessment.answer} htmlFor={name} hint={item.maxWords ? fmt(t.assessment.maxWords, { count: item.maxWords }) : undefined}>
          <TextArea id={name} dir="auto" disabled={disabled} rows={8} maxLength={50000} value={answer && "text" in answer ? answer.text : ""} onChange={(e) => onChange({ text: e.target.value })} />
        </Field>
      );
    case "oral_response":
      return (
        <Field label={t.assessment.recordingLink} htmlFor={name} hint={fmt(t.assessment.maxSeconds, { count: item.maxSeconds })}>
          <TextInput id={name} type="url" inputMode="url" dir="ltr" disabled={disabled} value={answer && "audioUrl" in answer ? answer.audioUrl : ""} onChange={(e) => onChange({ audioUrl: e.target.value })} />
        </Field>
      );
    case "word_order": {
      const tokens = answer && "tokens" in answer ? answer.tokens : item.tokens;
      const move = (from: number, to: number) => {
        if (to < 0 || to >= tokens.length) return;
        const next = [...tokens];
        const [token] = next.splice(from, 1);
        next.splice(to, 0, token);
        onChange({ tokens: next });
      };
      return (
        <div>
          <p className="mb-2 text-sm text-muted-foreground">{t.assessment.wordOrder}</p>
          <ol className="space-y-1">
            {tokens.map((token, index) => (
              <li key={`${token}-${index}`} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1">
                <span dir="auto">
                  {index + 1}. {token}
                </span>
                <span className="flex gap-1">
                  <Button type="button" size="sm" variant="ghost" disabled={disabled || index === 0} onClick={() => move(index, index - 1)} aria-label={`${t.assessment.moveUp}: ${token}`}>
                    ↑
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={disabled || index === tokens.length - 1} onClick={() => move(index, index + 1)} aria-label={`${t.assessment.moveDown}: ${token}`}>
                    ↓
                  </Button>
                </span>
              </li>
            ))}
          </ol>
        </div>
      );
    }
    case "matching": {
      const pairs = answer && "pairs" in answer ? answer.pairs : item.lefts.map((left) => ({ left, right: "" }));
      return (
        <div>
          <p className="mb-2 text-sm text-muted-foreground">{t.assessment.match}</p>
          <div className="space-y-2">
            {item.lefts.map((left, index) => {
              const id = `${name}-${index}`;
              const current = pairs.find((p) => p.left === left)?.right ?? "";
              return (
                <div key={left} className="grid gap-1 sm:grid-cols-2 sm:items-center">
                  <label htmlFor={id} dir="auto">
                    {left}
                  </label>
                  <SelectInput
                    id={id}
                    disabled={disabled}
                    value={current}
                    onChange={(e) => onChange({ pairs: item.lefts.map((l) => ({ left: l, right: l === left ? e.target.value : (pairs.find((p) => p.left === l)?.right ?? "") })) })}
                  >
                    <option value="">{t.common.choose}</option>
                    {item.rights.map((right) => (
                      <option key={right} value={right}>
                        {right}
                      </option>
                    ))}
                  </SelectInput>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  }
}
