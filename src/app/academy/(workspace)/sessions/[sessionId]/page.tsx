"use client";

import { useParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api, pages } from "@/components/academy/workspace/paths";
import type { Preparation, SessionAttendance, SessionDetail } from "@/components/academy/workspace/types";
import {
  ApiView,
  Badge,
  Button,
  Card,
  EmptyState,
  FailureNotice,
  Field,
  KeyValues,
  LinkButton,
  Notice,
  PageHeader,
  Section,
  SelectInput,
  TextArea,
  TextInput,
  TextLink,
} from "@/components/academy/workspace/ui";
import { displayName } from "@/lib/academy/workspace/format";

// One session: details for its participants; conduct, preparation and
// attendance for the staff the server permits.
export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { t } = useWorkspace();
  const { state, reload } = useApi<SessionDetail>(api.session(sessionId));

  return (
    <ApiView state={state} onRetry={reload}>
      {(detail) => (
        <>
          <PageHeader back={{ href: pages.classGroup(detail.classGroup.id), label: detail.classGroup.name }} title={detail.session.lessonTitle ?? t.session.title} />
          <SessionSummary detail={detail} onChanged={reload} />
          {detail.permissions.prepare && <PreparationPanel sessionId={sessionId} />}
          <AttendancePanel sessionId={sessionId} staff={detail.permissions.recordAttendance} />
        </>
      )}
    </ApiView>
  );
}

function SessionSummary({ detail, onChanged }: { readonly detail: SessionDetail; readonly onChanged: () => void }) {
  const { t, sessionTime } = useWorkspace();
  const action = useAction();
  const { session } = detail;

  async function conduct(kind: "start" | "complete") {
    const result = await action.run(api.session(session.id), "PATCH", { action: kind, expectedRevision: session.revision });
    if (result.ok) onChanged();
  }

  return (
    <Section title={t.common.details}>
      <Card>
        <KeyValues
          items={[
            { label: t.session.when, value: `${sessionTime(session.startsAt)} – ${sessionTime(session.endsAt)}` },
            { label: t.common.status, value: <Badge tone={session.state === "live" ? "strong" : "neutral"}>{t.classGroup.sessionState[session.state]}</Badge> },
            { label: t.common.classGroup, value: <TextLink href={pages.classGroup(detail.classGroup.id)}>{detail.classGroup.name}</TextLink> },
          ]}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {session.meetingUrl && (
            <LinkButton href={session.meetingUrl} variant="primary" external>
              {t.session.join}
            </LinkButton>
          )}
          <LinkButton href={pages.lessonSheet(detail.classGroup.id, session.lessonId)}>{t.session.lessonSheet}</LinkButton>
          {detail.permissions.conduct && session.state === "scheduled" && (
            <Button type="button" busy={action.busy} onClick={() => void conduct("start")}>
              {t.session.start}
            </Button>
          )}
          {detail.permissions.conduct && session.state === "live" && (
            <Button type="button" busy={action.busy} onClick={() => void conduct("complete")}>
              {t.session.complete}
            </Button>
          )}
        </div>
        {action.failure && (
          <div className="mt-3">
            <FailureNotice failure={action.failure} onRetry={onChanged} />
          </div>
        )}
      </Card>
    </Section>
  );
}

function PreparationPanel({ sessionId }: { readonly sessionId: string }) {
  const { t } = useWorkspace();
  const { state, reload } = useApi<Preparation>(api.preparation(sessionId));
  return (
    <Section title={t.session.preparation}>
      <ApiView state={state} onRetry={reload} notYet={t.session.prepNotYet}>
        {(preparation) => <PreparationForm key={preparation.revision} preparation={preparation} sessionId={sessionId} onSaved={reload} />}
      </ApiView>
    </Section>
  );
}

function PreparationForm({ preparation, sessionId, onSaved }: { readonly preparation: Preparation; readonly sessionId: string; readonly onSaved: () => void }) {
  const { t } = useWorkspace();
  const [status, setStatus] = useState<string>(preparation.status);
  const [notes, setNotes] = useState(preparation.privateNotes ?? "");
  const [saved, setSaved] = useState(false);
  const action = useAction();

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    const result = await action.run(api.preparation(sessionId), "PATCH", { status, privateNotes: notes, expectedRevision: preparation.revision });
    if (result.ok) {
      setSaved(true);
      onSaved();
    }
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-md border p-4">
      <Field label={t.common.status} htmlFor="prep-status">
        <SelectInput id="prep-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {(["not_started", "in_progress", "ready"] as const).map((value) => (
            <option key={value} value={value}>
              {t.session.prepStatus[value]}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label={t.session.prepNotes} htmlFor="prep-notes" hint={t.session.prepNotesHint}>
        <TextArea id="prep-notes" value={notes} maxLength={10000} rows={5} aria-describedby="prep-notes-hint" onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {action.failure && <FailureNotice failure={action.failure} onRetry={onSaved} />}
      {saved && <Notice tone="success">{t.common.saved}</Notice>}
      <Button type="submit" busy={action.busy}>
        {t.common.save}
      </Button>
    </form>
  );
}

function AttendancePanel({ sessionId, staff }: { readonly sessionId: string; readonly staff: boolean }) {
  const { t } = useWorkspace();
  const { state, reload } = useApi<SessionAttendance>(api.sessionAttendance(sessionId));
  return (
    <Section title={staff ? t.session.attendance : t.session.myMark}>
      <ApiView state={state} onRetry={reload}>
        {(data) => (isStaffAttendance(data) ? <AttendanceSheet key={JSON.stringify(data.records.map((r) => r.revision))} data={data} sessionId={sessionId} onSaved={reload} /> : <OwnMark data={data} />)}
      </ApiView>
    </Section>
  );
}

type StaffAttendance = Extract<SessionAttendance, { learners: readonly unknown[] }>;
type LearnerAttendance = Exclude<SessionAttendance, StaffAttendance>;

function isStaffAttendance(data: SessionAttendance): data is StaffAttendance {
  return Array.isArray((data as { learners?: unknown }).learners);
}

function OwnMark({ data }: { readonly data: LearnerAttendance }) {
  const { t, locale } = useWorkspace();
  const record = data.records[0];
  if (!record) return <EmptyState>{t.session.notMarked}</EmptyState>;
  const label = data.vocabulary?.marks.find((mark) => mark.code === record.markCode)?.labels[locale] ?? record.markCode;
  return <Badge tone={record.countsAsAttended ? "strong" : "warning"}>{label}</Badge>;
}

function AttendanceSheet({ data, sessionId, onSaved }: { readonly data: StaffAttendance; readonly sessionId: string; readonly onSaved: () => void }) {
  const { t, locale } = useWorkspace();
  const existing = useMemo(() => new Map(data.records.map((record) => [record.learnerUid, record])), [data.records]);
  const [marks, setMarks] = useState<Record<string, string>>(() => Object.fromEntries(data.records.map((r) => [r.learnerUid, r.markCode])));
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const action = useAction();

  if (!data.vocabulary) return <Notice tone="warning">{t.session.vocabularyMissing}</Notice>;
  if (data.sessionState !== "live" && data.sessionState !== "completed") return <Notice>{t.session.attendanceClosed}</Notice>;
  if (data.learners.length === 0) return <EmptyState>{t.session.noLearners}</EmptyState>;
  const vocabulary = data.vocabulary;

  const changed = data.learners.filter((learner) => marks[learner.uid] && marks[learner.uid] !== existing.get(learner.uid)?.markCode);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    const payload = changed.map((learner) => {
      const previous = existing.get(learner.uid);
      return { learnerUid: learner.uid, code: marks[learner.uid], reason: previous ? reasons[learner.uid] : undefined, expectedRevision: previous?.revision };
    });
    if (payload.length === 0) return;
    const result = await action.run(api.sessionAttendance(sessionId), "PUT", { marks: payload });
    if (result.ok) {
      setSaved(true);
      onSaved();
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <ul className="divide-y rounded-md border">
        {data.learners.map((learner) => {
          const previous = existing.get(learner.uid);
          const isCorrection = previous !== undefined && marks[learner.uid] !== previous.markCode;
          const fieldId = `mark-${learner.uid}`;
          return (
            <li key={learner.uid} className="grid gap-2 p-3 sm:grid-cols-[1fr_minmax(10rem,14rem)] sm:items-center">
              <label htmlFor={fieldId} className="font-medium">
                {displayName(learner.displayName, t.common.unnamed)}
              </label>
              <SelectInput id={fieldId} value={marks[learner.uid] ?? ""} onChange={(e) => setMarks((m) => ({ ...m, [learner.uid]: e.target.value }))}>
                <option value="">{t.session.notMarked}</option>
                {vocabulary.marks.map((mark) => (
                  <option key={mark.code} value={mark.code}>
                    {mark.labels[locale]}
                  </option>
                ))}
              </SelectInput>
              {isCorrection && (
                <div className="sm:col-span-2">
                  <Field label={t.session.correctionReason} htmlFor={`${fieldId}-reason`}>
                    <TextInput id={`${fieldId}-reason`} required maxLength={2000} value={reasons[learner.uid] ?? ""} onChange={(e) => setReasons((r) => ({ ...r, [learner.uid]: e.target.value }))} />
                  </Field>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {action.failure && <FailureNotice failure={action.failure} onRetry={onSaved} />}
      {saved && <Notice tone="success">{t.common.saved}</Notice>}
      <Button type="submit" busy={action.busy} disabled={changed.length === 0}>
        {t.session.saveAttendance}
      </Button>
    </form>
  );
}
