"use client";

import { useParams } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { cn } from "@/lib/utils";
import { api, pages } from "@/components/academy/workspace/paths";
import type { Annotation, LessonSheet, SheetAvailabilityList } from "@/components/academy/workspace/types";
import { ApiView, Badge, Button, FailureNotice, Field, Notice, PageHeader, TextArea } from "@/components/academy/workspace/ui";
import type { LessonBlock } from "@/lib/academy/lessons/content";

// A Lesson Sheet. The server applies the locked release rule and the audience
// projection (learners never receive teacher notes or answers) on every
// request; this page only renders what it receives.
export default function LessonSheetPage() {
  const { classGroupId, lessonId } = useParams<{ classGroupId: string; lessonId: string }>();
  const { t } = useWorkspace();
  const { state, reload } = useApi<LessonSheet>(api.lessonSheet(classGroupId, lessonId));
  const notYet = state.status === "failed" && state.failure.kind === "not_yet";

  return (
    <>
      <PageHeader
        back={{ href: pages.classGroup(classGroupId, "lessons"), label: t.lesson.back }}
        title={state.status === "ready" ? (state.data.lesson.title ?? t.common.lesson) : t.common.lesson}
        intro={state.status === "ready" ? state.data.lesson.summary : undefined}
      />
      <ApiView state={state} onRetry={reload} notYet={notYet ? <ReleaseNotice classGroupId={classGroupId} lessonId={lessonId} /> : undefined}>
        {(sheet) => <Sheet sheet={sheet} classGroupId={classGroupId} lessonId={lessonId} onChanged={reload} />}
      </ApiView>
    </>
  );
}

/** Explains when a sheet opens, using the release time the server computed. No content is requested. */
function ReleaseNotice({ classGroupId, lessonId }: { readonly classGroupId: string; readonly lessonId: string }) {
  const { t, fmt, sessionTime } = useWorkspace();
  const { state } = useApi<SheetAvailabilityList>(api.lessonSheets(classGroupId));
  const entry = state.status === "ready" ? state.data.find((row) => row.lessonId === lessonId) : undefined;
  if (entry && entry.availability.status === "scheduled") return <>{fmt(t.lesson.notYet, { date: sessionTime(entry.availability.releaseAt) })}</>;
  return <>{t.lesson.notYetUnknown}</>;
}

function Sheet({ sheet, classGroupId, lessonId, onChanged }: { readonly sheet: LessonSheet; readonly classGroupId: string; readonly lessonId: string; readonly onChanged: () => void }) {
  const { t, fmt, date } = useWorkspace();
  const byBlock = new Map<string, Annotation[]>();
  for (const annotation of sheet.annotations) {
    if (annotation.orphaned) continue;
    byBlock.set(annotation.blockId, [...(byBlock.get(annotation.blockId) ?? []), annotation]);
  }
  const orphaned = sheet.annotations.filter((annotation) => annotation.orphaned);

  return (
    <article className="mx-auto max-w-3xl">
      <p className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge>{fmt(t.lesson.version, { number: sheet.version.versionNumber })}</Badge>
        {sheet.version.publishedAt && <span>{date(sheet.version.publishedAt)}</span>}
      </p>
      <Notice>{t.lesson.notesPrivate}</Notice>
      <div className="mt-6 space-y-6">
        {sheet.content.blocks.map((block) => (
          <BlockWithNotes key={block.id} block={block} annotations={byBlock.get(block.id) ?? []} classGroupId={classGroupId} lessonId={lessonId} onChanged={onChanged} />
        ))}
      </div>
      {orphaned.length > 0 && (
        <section className="mt-10" aria-label={t.lesson.myNotes}>
          <Notice tone="warning">{t.lesson.detached}</Notice>
          <ul className="mt-3 space-y-2">
            {orphaned.map((annotation) => (
              <li key={annotation.id}>
                <NoteItem annotation={annotation} onChanged={onChanged} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function anchorText(block: LessonBlock): string | null {
  switch (block.type) {
    case "heading":
    case "paragraph":
    case "arabic_text":
    case "example":
    case "teacher_note":
      return block.text;
    default:
      return null;
  }
}

/** Renders text with the reader's highlighted ranges marked. */
function MarkedText({ text, annotations }: { readonly text: string; readonly annotations: readonly Annotation[] }) {
  const ranges = annotations
    .filter((a) => a.range !== null)
    .map((a) => a.range as { start: number; end: number })
    .filter((r) => r.start >= 0 && r.end <= text.length && r.end > r.start)
    .sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  const parts: ReactNode[] = [];
  let cursor = 0;
  merged.forEach((range, index) => {
    if (range.start > cursor) parts.push(text.slice(cursor, range.start));
    parts.push(
      <mark key={index} className="rounded-sm bg-accent text-accent-foreground">
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

function BlockWithNotes({
  block,
  annotations,
  classGroupId,
  lessonId,
  onChanged,
}: {
  readonly block: LessonBlock;
  readonly annotations: readonly Annotation[];
  readonly classGroupId: string;
  readonly lessonId: string;
  readonly onChanged: () => void;
}) {
  const { t } = useWorkspace();
  const textRef = useRef<HTMLDivElement>(null);
  const [adding, setAdding] = useState(false);
  const [body, setBody] = useState("");
  const action = useAction();
  const text = anchorText(block);
  const wholeBlockHighlighted = annotations.some((a) => a.kind === "highlight" && a.range === null);

  /** The selected character range inside this block's text, when the selection lies entirely within it. */
  function selectedRange(): { start: number; end: number } | undefined {
    const element = textRef.current;
    const selection = typeof window === "undefined" ? null : window.getSelection();
    if (!element || !selection || selection.rangeCount === 0 || selection.isCollapsed || text === null) return undefined;
    const range = selection.getRangeAt(0);
    if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return undefined;
    const before = document.createRange();
    before.selectNodeContents(element);
    before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length;
    const end = start + range.toString().length;
    return end > start && end <= text.length ? { start, end } : undefined;
  }

  async function create(kind: "highlight" | "note", noteBody?: string) {
    const result = await action.run(api.annotations(classGroupId, lessonId), "POST", { blockId: block.id, kind, range: selectedRange(), body: noteBody });
    if (result.ok) {
      setBody("");
      setAdding(false);
      onChanged();
    }
  }

  function submitNote(event: FormEvent) {
    event.preventDefault();
    void create("note", body);
  }

  return (
    <div className={cn("group", wholeBlockHighlighted && "rounded-md border-s-4 border-primary bg-muted/40 ps-3")}>
      <div ref={textRef}>
        <BlockView block={block} annotations={annotations} />
      </div>
      {block.type !== "divider" && (
        /* The reading surface stays a reader: tools appear on hover or focus
           on fine pointers, and stay always-visible on touch screens. */
        <div className="mt-1.5 flex flex-wrap items-center gap-2 transition-opacity motion-reduce:transition-none sm:opacity-0 sm:focus-within:opacity-100 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <Button type="button" size="sm" variant="ghost" busy={action.busy} onClick={() => void create("highlight")}>
            {t.lesson.highlight}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
            {t.lesson.addNote}
          </Button>
        </div>
      )}
      {action.failure && <FailureNotice failure={action.failure} />}
      {adding && (
        <form onSubmit={submitNote} className="mt-2 space-y-2">
          <Field label={t.lesson.noteText} htmlFor={`note-${block.id}`}>
            <TextArea id={`note-${block.id}`} value={body} required maxLength={5000} rows={3} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <Button type="submit" size="sm" busy={action.busy}>
            {t.lesson.saveNote}
          </Button>
        </form>
      )}
      {annotations.length > 0 && (
        <ul className="mt-2 space-y-2" aria-label={t.lesson.myNotes}>
          {annotations.map((annotation) => (
            <li key={annotation.id}>
              <NoteItem annotation={annotation} onChanged={onChanged} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NoteItem({ annotation, onChanged }: { readonly annotation: Annotation; readonly onChanged: () => void }) {
  const { t } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(annotation.body ?? "");
  const action = useAction();

  async function save(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(api.annotation(annotation.id), "PATCH", { action: "update", body, expectedRevision: annotation.revision });
    if (result.ok) {
      setEditing(false);
      onChanged();
    }
  }

  async function remove() {
    const result = await action.run(api.annotation(annotation.id), "PATCH", { action: "delete", expectedRevision: annotation.revision });
    if (result.ok) onChanged();
  }

  return (
    <div className="rounded-md border bg-muted/30 p-2 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <Badge>{t.lesson.noteKind[annotation.kind]}</Badge>
        {annotation.quote && <q className="text-muted-foreground">{annotation.quote}</q>}
      </p>
      {!editing && annotation.body && <p className="mt-1 whitespace-pre-line break-words">{annotation.body}</p>}
      {editing && (
        <form onSubmit={save} className="mt-2 space-y-2">
          <Field label={t.lesson.noteText} htmlFor={`edit-${annotation.id}`}>
            <TextArea id={`edit-${annotation.id}`} value={body} maxLength={5000} rows={3} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <Button type="submit" size="sm" busy={action.busy}>
            {t.lesson.saveNote}
          </Button>
        </form>
      )}
      <div className="mt-2 flex gap-2">
        {annotation.kind === "note" && !editing && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
            {t.common.edit}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" busy={action.busy} onClick={() => void remove()}>
          {t.lesson.deleteNote}
        </Button>
      </div>
      {action.failure && <FailureNotice failure={action.failure} />}
    </div>
  );
}

function BlockView({ block, annotations }: { readonly block: LessonBlock; readonly annotations: readonly Annotation[] }) {
  const { t, fmt } = useWorkspace();
  switch (block.type) {
    case "heading": {
      const Tag = block.level === 1 ? "h2" : block.level === 2 ? "h3" : "h4";
      return (
        <Tag className={block.level === 1 ? "font-serif text-3xl" : block.level === 2 ? "font-serif text-2xl" : "text-lg font-medium"}>
          <MarkedText text={block.text} annotations={annotations} />
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p className="whitespace-pre-line leading-relaxed">
          <MarkedText text={block.text} annotations={annotations} />
        </p>
      );
    case "arabic_text":
      return (
        <div>
          <p lang="ar" dir="rtl" className="whitespace-pre-line font-arabic text-3xl leading-loose">
            <MarkedText text={block.text} annotations={annotations} />
          </p>
          {block.translation && (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="sr-only">{t.lesson.translation}: </span>
              {block.translation}
            </p>
          )}
        </div>
      );
    case "example":
      return (
        <blockquote className="border-s-4 border-s-gold/60 py-1 ps-4">
          <p className="whitespace-pre-line">
            <MarkedText text={block.text} annotations={annotations} />
          </p>
          {block.translation && <p className="mt-1 text-sm text-muted-foreground">{block.translation}</p>}
        </blockquote>
      );
    case "list": {
      const items = block.items.map((item, index) => <li key={index}>{item}</li>);
      return block.ordered ? <ol className="list-decimal space-y-1 ps-6">{items}</ol> : <ul className="list-disc space-y-1 ps-6">{items}</ul>;
    }
    case "vocabulary":
      return (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
          <tbody>
            {block.entries.map((entry, index) => (
              <tr key={index} className="border-t">
                <th scope="row" className="px-3 py-2 pe-3 text-start font-arabic text-base" lang="ar" dir="auto">
                  {entry.term}
                </th>
                <td className="px-3 py-2">
                  {entry.meaning}
                  {entry.note && <span className="block text-muted-foreground">{entry.note}</span>}
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      );
    case "exercise":
      return (
        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="font-medium">
            {fmt(t.lesson.exerciseOf, { prompt: block.prompt })}
          </p>
          <ol className="mt-2 list-decimal space-y-2 ps-6">
            {block.questions.map((question) => (
              <li key={question.id}>
                <p>{question.question}</p>
                <ul className="mt-1 space-y-1 ps-2">
                  {question.options.map((option) => (
                    <li key={option.id} className="flex items-center gap-2">
                      <span aria-hidden="true">○</span>
                      <span>{option.text}</span>
                      {question.correctOptionId === option.id && <Badge tone="strong">{t.lesson.answer}</Badge>}
                    </li>
                  ))}
                </ul>
                {question.explanation && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {fmt(t.lesson.explanationOf, { text: question.explanation })}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      );
    case "audio":
      return (
        <figure>
          <figcaption className="mb-1 font-medium">{block.title}</figcaption>
          <audio controls preload="none" src={block.url} className="w-full" />
          {block.transcript && (
            <details className="mt-1 text-sm">
              <summary className="cursor-pointer">{t.lesson.transcript}</summary>
              <p className="mt-1 whitespace-pre-line">{block.transcript}</p>
            </details>
          )}
        </figure>
      );
    case "image":
      return (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element -- authored https images from any host */}
          <img src={block.url} alt={block.alt} className="h-auto max-w-full rounded-md" loading="lazy" referrerPolicy="no-referrer" />
          {block.caption && <figcaption className="mt-1 text-sm text-muted-foreground">{block.caption}</figcaption>}
        </figure>
      );
    case "teacher_note":
      return (
        <aside className="rounded-md border border-dashed p-3">
          <p className="text-sm font-medium">{t.lesson.teacherNote}</p>
          <p className="whitespace-pre-line">
            <MarkedText text={block.text} annotations={annotations} />
          </p>
        </aside>
      );
    case "divider":
      return <hr />;
  }
}
