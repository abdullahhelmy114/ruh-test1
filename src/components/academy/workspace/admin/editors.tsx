"use client";

import { useState, type FormEvent } from "react";
import { ITEM_TYPES, type ItemType } from "@/lib/academy/assessment/content";
import { BLOCK_TYPES, type BlockType } from "@/lib/academy/lessons/content";
import {
  emptyBlockForm,
  emptyItemForm,
  formsToAssessmentInput,
  formsToLessonInput,
  formsToOutlineInput,
  move,
  nextItemId,
  type BlockForm,
  type ItemForm,
  type OutlineLessonForm,
  type OutlineUnitForm,
} from "@/lib/academy/workspace/editor-forms";
import { fmt } from "@/lib/academy/workspace/format";
import { useAction } from "../api";
import { useWorkspace } from "../context";
import { Button, EmptyState, FailureNotice, Field, Notice, SelectInput, TextArea, TextInput } from "../ui";
import { Saved, useAdminText } from "./kit";

let keySeed = 0;
const newKey = () => `new-${++keySeed}`;

function MoveButtons({ index, length, onMove, label }: { readonly index: number; readonly length: number; readonly onMove: (to: number) => void; readonly label: string }) {
  const text = useAdminText();
  return (
    <span className="flex gap-1">
      <Button type="button" size="sm" variant="ghost" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={`${text.outline.moveUp}: ${label}`}>
        ↑
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={index === length - 1} onClick={() => onMove(index + 1)} aria-label={`${text.outline.moveDown}: ${label}`}>
        ↓
      </Button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Curriculum outline
// ---------------------------------------------------------------------------

export function OutlineEditor({ initial, editable, url, revision, onSaved }: { readonly initial: OutlineUnitForm[]; readonly editable: boolean; readonly url: string; readonly revision: number; readonly onSaved: () => void }) {
  const text = useAdminText();
  const [units, setUnits] = useState<OutlineUnitForm[]>(initial);
  const [saved, setSaved] = useState(false);
  const action = useAction();

  const updateUnit = (index: number, patch: Partial<OutlineUnitForm>) => setUnits((u) => u.map((unit, i) => (i === index ? { ...unit, ...patch } : unit)));
  const updateLesson = (unitIndex: number, lessonIndex: number, patch: Partial<OutlineLessonForm>) =>
    updateUnit(unitIndex, { lessons: units[unitIndex].lessons.map((lesson, i) => (i === lessonIndex ? { ...lesson, ...patch } : lesson)) });

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    const result = await action.run(url, "PATCH", { action: "save_outline", outline: formsToOutlineInput(units), expectedRevision: revision });
    if (result.ok) {
      setSaved(true);
      onSaved();
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {!editable && <Notice>{text.outline.readOnly}</Notice>}
      <fieldset disabled={!editable || action.busy} className="space-y-4">
        {units.map((unit, unitIndex) => (
          <div key={unit.key} className="space-y-3 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{fmt(text.outline.unit, { number: unitIndex + 1 })}</h3>
              <span className="flex gap-2">
                <MoveButtons index={unitIndex} length={units.length} label={unit.title} onMove={(to) => setUnits((u) => move(u, unitIndex, to))} />
                <Button type="button" size="sm" variant="danger" onClick={() => setUnits((u) => u.filter((_, i) => i !== unitIndex))}>
                  {text.outline.removeUnit}
                </Button>
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={text.outline.unitTitle} htmlFor={`${unit.key}-title`}>
                <TextInput id={`${unit.key}-title`} required maxLength={200} value={unit.title} onChange={(e) => updateUnit(unitIndex, { title: e.target.value })} />
              </Field>
              <Field label={text.outline.summary} htmlFor={`${unit.key}-summary`} optional>
                <TextInput id={`${unit.key}-summary`} maxLength={2000} value={unit.summary} onChange={(e) => updateUnit(unitIndex, { summary: e.target.value })} />
              </Field>
            </div>
            <ol className="space-y-2 ps-2">
              {unit.lessons.map((lesson, lessonIndex) => (
                <li key={lesson.key} className="grid gap-2 rounded-md border p-2 md:grid-cols-[2fr_2fr_8rem_auto] md:items-end">
                  <Field label={text.outline.lessonTitle} htmlFor={`${lesson.key}-title`}>
                    <TextInput id={`${lesson.key}-title`} required maxLength={200} value={lesson.title} onChange={(e) => updateLesson(unitIndex, lessonIndex, { title: e.target.value })} />
                  </Field>
                  <Field label={text.outline.summary} htmlFor={`${lesson.key}-summary`} optional>
                    <TextInput id={`${lesson.key}-summary`} maxLength={2000} value={lesson.summary} onChange={(e) => updateLesson(unitIndex, lessonIndex, { summary: e.target.value })} />
                  </Field>
                  <Field label={text.outline.plannedMinutes} htmlFor={`${lesson.key}-minutes`} optional>
                    <TextInput id={`${lesson.key}-minutes`} type="number" min={1} max={1440} value={lesson.plannedMinutes} onChange={(e) => updateLesson(unitIndex, lessonIndex, { plannedMinutes: e.target.value })} />
                  </Field>
                  <span className="flex gap-1">
                    <MoveButtons index={lessonIndex} length={unit.lessons.length} label={lesson.title} onMove={(to) => updateUnit(unitIndex, { lessons: move(unit.lessons, lessonIndex, to) })} />
                    <Button type="button" size="sm" variant="danger" onClick={() => updateUnit(unitIndex, { lessons: unit.lessons.filter((_, i) => i !== lessonIndex) })}>
                      {text.outline.removeLesson}
                    </Button>
                  </span>
                </li>
              ))}
            </ol>
            <Button type="button" size="sm" variant="outline" onClick={() => updateUnit(unitIndex, { lessons: [...unit.lessons, { key: newKey(), lessonId: null, title: "", summary: "", plannedMinutes: "" }] })}>
              {text.outline.addLesson}
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setUnits((u) => [...u, { key: newKey(), unitId: null, title: "", summary: "", lessons: [] }])}>
          {text.outline.addUnit}
        </Button>
      </fieldset>
      {action.failure && <FailureNotice failure={action.failure} onRetry={onSaved} />}
      <Saved show={saved} />
      {editable && (
        <Button type="submit" busy={action.busy}>
          {text.outline.save}
        </Button>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Lesson Script blocks
// ---------------------------------------------------------------------------

export function BlockEditor({ initial, editable, url, revision, onSaved }: { readonly initial: BlockForm[]; readonly editable: boolean; readonly url: string; readonly revision: number; readonly onSaved: () => void }) {
  const text = useAdminText();
  const { t } = useWorkspace();
  const [blocks, setBlocks] = useState<(BlockForm & { key: string })[]>(() => initial.map((block) => ({ ...block, key: block.id || newKey() })));
  const [addType, setAddType] = useState<BlockType>("paragraph");
  const [saved, setSaved] = useState(false);
  const action = useAction();
  const update = (index: number, patch: Partial<BlockForm>) => setBlocks((b) => b.map((block, i) => (i === index ? { ...block, ...patch } : block)));

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    const result = await action.run(url, "PATCH", { action: "save_content", content: formsToLessonInput(blocks), expectedRevision: revision });
    if (result.ok) {
      setSaved(true);
      onSaved();
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {!editable && <Notice>{text.script.readOnly}</Notice>}
      <fieldset disabled={!editable || action.busy} className="space-y-3">
        {blocks.length === 0 && <EmptyState>{text.script.noBlocks}</EmptyState>}
        {blocks.map((block, index) => {
          const id = `block-${block.key}`;
          return (
            <div key={block.key} className="space-y-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {index + 1}. {text.script.blockType[block.type]}
                </span>
                <span className="flex gap-2">
                  <MoveButtons index={index} length={blocks.length} label={text.script.blockType[block.type]} onMove={(to) => setBlocks((b) => move(b, index, to))} />
                  <Button type="button" size="sm" variant="danger" onClick={() => setBlocks((b) => b.filter((_, i) => i !== index))}>
                    {text.script.removeBlock}
                  </Button>
                </span>
              </div>
              {block.type === "heading" && (
                <Field label={text.script.level} htmlFor={`${id}-level`}>
                  <SelectInput id={`${id}-level`} value={block.level} onChange={(e) => update(index, { level: e.target.value })}>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </SelectInput>
                </Field>
              )}
              {["heading", "paragraph", "arabic_text", "example", "teacher_note"].includes(block.type) && (
                <Field label={text.script.text} htmlFor={`${id}-text`}>
                  <TextArea id={`${id}-text`} dir={block.type === "arabic_text" ? "rtl" : "auto"} required rows={block.type === "heading" ? 1 : 4} value={block.text} onChange={(e) => update(index, { text: e.target.value })} />
                </Field>
              )}
              {(block.type === "arabic_text" || block.type === "example") && (
                <Field label={text.script.translation} htmlFor={`${id}-translation`} optional>
                  <TextArea id={`${id}-translation`} rows={2} value={block.translation} onChange={(e) => update(index, { translation: e.target.value })} />
                </Field>
              )}
              {block.type === "list" && (
                <>
                  <Field label={text.script.lines} htmlFor={`${id}-lines`}>
                    <TextArea id={`${id}-lines`} dir="auto" required rows={4} value={block.lines} onChange={(e) => update(index, { lines: e.target.value })} />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={block.ordered} onChange={(e) => update(index, { ordered: e.target.checked })} />
                    {text.script.ordered}
                  </label>
                </>
              )}
              {block.type === "vocabulary" && (
                <Field label={text.script.entries} htmlFor={`${id}-lines`}>
                  <TextArea id={`${id}-lines`} dir="auto" required rows={5} value={block.lines} onChange={(e) => update(index, { lines: e.target.value })} />
                </Field>
              )}
              {block.type === "exercise" && (
                <>
                  <Field label={text.script.prompt} htmlFor={`${id}-prompt`}>
                    <TextInput id={`${id}-prompt`} required dir="auto" value={block.prompt} onChange={(e) => update(index, { prompt: e.target.value })} />
                  </Field>
                  <Field label={text.script.questions} htmlFor={`${id}-lines`}>
                    <TextArea id={`${id}-lines`} dir="auto" required rows={5} value={block.lines} onChange={(e) => update(index, { lines: e.target.value })} />
                  </Field>
                </>
              )}
              {block.type === "audio" && (
                <>
                  <Field label={text.script.audioTitle} htmlFor={`${id}-title`}>
                    <TextInput id={`${id}-title`} required value={block.title} onChange={(e) => update(index, { title: e.target.value })} />
                  </Field>
                  <Field label={text.script.url} htmlFor={`${id}-url`}>
                    <TextInput id={`${id}-url`} required type="url" dir="ltr" value={block.url} onChange={(e) => update(index, { url: e.target.value })} />
                  </Field>
                  <Field label={text.script.transcript} htmlFor={`${id}-transcript`} optional>
                    <TextArea id={`${id}-transcript`} dir="auto" rows={3} value={block.transcript} onChange={(e) => update(index, { transcript: e.target.value })} />
                  </Field>
                </>
              )}
              {block.type === "image" && (
                <>
                  <Field label={text.script.url} htmlFor={`${id}-url`}>
                    <TextInput id={`${id}-url`} required type="url" dir="ltr" value={block.url} onChange={(e) => update(index, { url: e.target.value })} />
                  </Field>
                  <Field label={text.script.alt} htmlFor={`${id}-alt`}>
                    <TextInput id={`${id}-alt`} required value={block.alt} onChange={(e) => update(index, { alt: e.target.value })} />
                  </Field>
                  <Field label={text.script.caption} htmlFor={`${id}-caption`} optional>
                    <TextInput id={`${id}-caption`} value={block.caption} onChange={(e) => update(index, { caption: e.target.value })} />
                  </Field>
                </>
              )}
            </div>
          );
        })}
        <div className="flex flex-wrap items-end gap-2">
          <Field label={text.script.addBlock} htmlFor="add-block-type">
            <SelectInput id="add-block-type" value={addType} onChange={(e) => setAddType(e.target.value as BlockType)}>
              {BLOCK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {text.script.blockType[type]}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Button type="button" variant="outline" onClick={() => setBlocks((b) => [...b, { ...emptyBlockForm(addType), key: newKey() }])}>
            {text.script.addBlock}
          </Button>
        </div>
      </fieldset>
      {action.failure && <FailureNotice failure={action.failure} onRetry={onSaved} />}
      <Saved show={saved} />
      {editable && (
        <Button type="submit" busy={action.busy}>
          {text.script.save}
        </Button>
      )}
      <span className="sr-only">{t.common.optional}</span>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Assessment items
// ---------------------------------------------------------------------------

export function ItemEditor({
  initialInstructions,
  initial,
  editable,
  url,
  revision,
  onSaved,
}: {
  readonly initialInstructions: string;
  readonly initial: ItemForm[];
  readonly editable: boolean;
  readonly url: string;
  readonly revision: number;
  readonly onSaved: () => void;
}) {
  const text = useAdminText();
  const [instructions, setInstructions] = useState(initialInstructions);
  const [items, setItems] = useState<(ItemForm & { key: string })[]>(() => initial.map((item) => ({ ...item, key: newKey() })));
  const [addType, setAddType] = useState<ItemType>("choice");
  const [saved, setSaved] = useState(false);
  const action = useAction();
  const update = (index: number, patch: Partial<ItemForm>) => setItems((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    const result = await action.run(url, "PATCH", { action: "save_content", content: formsToAssessmentInput(instructions, items), expectedRevision: revision });
    if (result.ok) {
      setSaved(true);
      onSaved();
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {!editable && <Notice>{text.script.readOnly}</Notice>}
      <fieldset disabled={!editable || action.busy} className="space-y-3">
        <Field label={text.assessmentEditor.instructions} htmlFor="assessment-instructions" optional>
          <TextArea id="assessment-instructions" dir="auto" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </Field>
        {items.length === 0 && <EmptyState>{text.assessmentEditor.noItems}</EmptyState>}
        {items.map((item, index) => {
          const id = `item-${item.key}`;
          const needsOptions = item.type === "choice" || item.type === "listening";
          return (
            <div key={item.key} className="space-y-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {index + 1}. {text.assessmentEditor.itemType[item.type]}
                </span>
                <span className="flex gap-2">
                  <MoveButtons index={index} length={items.length} label={item.id} onMove={(to) => setItems((list) => move(list, index, to))} />
                  <Button type="button" size="sm" variant="danger" onClick={() => setItems((list) => list.filter((_, i) => i !== index))}>
                    {text.assessmentEditor.removeItem}
                  </Button>
                </span>
              </div>
              <div className="grid gap-2 md:grid-cols-[10rem_1fr_7rem]">
                <Field label={text.assessmentEditor.itemId} htmlFor={`${id}-id`}>
                  <TextInput id={`${id}-id`} required dir="ltr" pattern="[A-Za-z0-9_-]{1,64}" value={item.id} onChange={(e) => update(index, { id: e.target.value })} />
                </Field>
                <Field label={text.assessmentEditor.prompt} htmlFor={`${id}-prompt`}>
                  <TextInput id={`${id}-prompt`} required dir="auto" value={item.prompt} onChange={(e) => update(index, { prompt: e.target.value })} />
                </Field>
                <Field label={text.assessmentEditor.points} htmlFor={`${id}-points`}>
                  <TextInput id={`${id}-points`} type="number" min={1} max={100} required value={item.points} onChange={(e) => update(index, { points: e.target.value })} />
                </Field>
              </div>
              {item.type === "listening" && (
                <Field label={text.assessmentEditor.audioUrl} htmlFor={`${id}-audio`}>
                  <TextInput id={`${id}-audio`} type="url" dir="ltr" required value={item.audioUrl} onChange={(e) => update(index, { audioUrl: e.target.value })} />
                </Field>
              )}
              {needsOptions && (
                <div className="grid gap-2 md:grid-cols-[1fr_12rem]">
                  <Field label={text.assessmentEditor.options} htmlFor={`${id}-options`}>
                    <TextArea id={`${id}-options`} dir="auto" required rows={4} value={item.options} onChange={(e) => update(index, { options: e.target.value })} />
                  </Field>
                  <Field label={text.assessmentEditor.correctIndex} htmlFor={`${id}-correct`}>
                    <TextInput id={`${id}-correct`} type="number" min={1} required value={item.correctNumber} onChange={(e) => update(index, { correctNumber: e.target.value })} />
                  </Field>
                </div>
              )}
              {item.type === "true_false" && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={item.correctTrue} onChange={(e) => update(index, { correctTrue: e.target.checked })} />
                  {text.assessmentEditor.correctTrue}
                </label>
              )}
              {(item.type === "fill_blank" || item.type === "short_text") && (
                <Field label={item.type === "fill_blank" ? text.assessmentEditor.accepted : text.assessmentEditor.acceptedOptional} htmlFor={`${id}-accepted`}>
                  <TextArea id={`${id}-accepted`} dir="auto" required={item.type === "fill_blank"} rows={3} value={item.accepted} onChange={(e) => update(index, { accepted: e.target.value })} />
                </Field>
              )}
              {item.type === "short_text" && (
                <Field label={text.assessmentEditor.maxLength} htmlFor={`${id}-max-length`}>
                  <TextInput id={`${id}-max-length`} type="number" min={1} max={2000} value={item.maxLength} onChange={(e) => update(index, { maxLength: e.target.value })} />
                </Field>
              )}
              {item.type === "word_order" && (
                <Field label={text.assessmentEditor.order} htmlFor={`${id}-order`}>
                  <TextArea id={`${id}-order`} dir="auto" required rows={4} value={item.order} onChange={(e) => update(index, { order: e.target.value })} />
                </Field>
              )}
              {item.type === "matching" && (
                <Field label={text.assessmentEditor.pairs} htmlFor={`${id}-pairs`}>
                  <TextArea id={`${id}-pairs`} dir="auto" required rows={4} value={item.pairs} onChange={(e) => update(index, { pairs: e.target.value })} />
                </Field>
              )}
              {item.type === "essay" && (
                <Field label={text.assessmentEditor.maxWords} htmlFor={`${id}-max-words`} optional>
                  <TextInput id={`${id}-max-words`} type="number" min={1} max={10000} value={item.maxWords} onChange={(e) => update(index, { maxWords: e.target.value })} />
                </Field>
              )}
              {item.type === "oral_response" && (
                <Field label={text.assessmentEditor.maxSeconds} htmlFor={`${id}-max-seconds`}>
                  <TextInput id={`${id}-max-seconds`} type="number" min={5} max={3600} required value={item.maxSeconds} onChange={(e) => update(index, { maxSeconds: e.target.value })} />
                </Field>
              )}
              {(item.type === "essay" || item.type === "oral_response") && (
                <Field label={text.assessmentEditor.rubric} htmlFor={`${id}-rubric`} optional>
                  <TextArea id={`${id}-rubric`} dir="auto" rows={3} value={item.rubric} onChange={(e) => update(index, { rubric: e.target.value })} />
                </Field>
              )}
            </div>
          );
        })}
        <div className="flex flex-wrap items-end gap-2">
          <Field label={text.assessmentEditor.addItem} htmlFor="add-item-type">
            <SelectInput id="add-item-type" value={addType} onChange={(e) => setAddType(e.target.value as ItemType)}>
              {ITEM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {text.assessmentEditor.itemType[type]}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Button type="button" variant="outline" onClick={() => setItems((list) => [...list, { ...emptyItemForm(addType, nextItemId(list)), key: newKey() }])}>
            {text.assessmentEditor.addItem}
          </Button>
        </div>
      </fieldset>
      {action.failure && <FailureNotice failure={action.failure} onRetry={onSaved} />}
      <Saved show={saved} />
      {editable && (
        <Button type="submit" busy={action.busy}>
          {text.assessmentEditor.save}
        </Button>
      )}
    </form>
  );
}
