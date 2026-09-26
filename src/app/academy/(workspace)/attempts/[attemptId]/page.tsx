"use client";

import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api, pages } from "@/components/academy/workspace/paths";
import type { AttemptView, Roster } from "@/components/academy/workspace/types";
import {
  ApiView,
  Badge,
  Button,
  Card,
  FailureNotice,
  Field,
  KeyValues,
  LinkButton,
  Notice,
  PageHeader,
  Section,
  TextArea,
  TextInput,
} from "@/components/academy/workspace/ui";
import type { AttemptRecord } from "@/lib/academy/assessment/delivery";
import { displayName } from "@/lib/academy/workspace/format";

type LearnerAttempt = Exclude<AttemptView, AttemptRecord>;

function isGraderView(view: AttemptView): view is AttemptRecord {
  return typeof (view as { learnerUid?: unknown }).learnerUid === "string";
}

// One attempt: learners see their own (results only once released);
// the class group's graders grade, release and return it.
export default function AttemptPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { t } = useWorkspace();
  const { state, reload } = useApi<AttemptView>(api.attempt(attemptId));
  return (
    <ApiView state={state} onRetry={reload}>
      {(view) => (
        <>
          <PageHeader back={{ href: pages.assignment(view.assignmentId), label: t.common.back }} title={t.attempt.title} />
          {isGraderView(view) ? <Grading attempt={view} onChanged={reload} /> : <LearnerResult attempt={view} />}
        </>
      )}
    </ApiView>
  );
}

function responseText(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const r = response as Record<string, unknown>;
  if (typeof r.text === "string") return r.text;
  if (typeof r.value === "boolean") return String(r.value);
  if (typeof r.optionIndex === "number") return `#${r.optionIndex + 1}`;
  if (Array.isArray(r.tokens)) return r.tokens.join(" ");
  if (Array.isArray(r.pairs)) return (r.pairs as { left: string; right: string }[]).map((p) => `${p.left} → ${p.right}`).join(", ");
  if (typeof r.audioUrl === "string") return r.audioUrl;
  return "";
}

function LearnerResult({ attempt }: { readonly attempt: LearnerAttempt }) {
  const { t, fmt, dateTime } = useWorkspace();
  const result = attempt.result;
  return (
    <>
      <Card className="mb-6">
        <KeyValues
          items={[
            { label: t.common.status, value: <Badge tone={result ? "strong" : "neutral"}>{t.assessment.state[attempt.state as keyof typeof t.assessment.state] ?? attempt.state}</Badge> },
            { label: t.assessment.attempts, value: fmt(t.assessment.attempt, { number: attempt.attemptNumber }) },
            ...(attempt.submittedAt ? [{ label: t.common.details, value: dateTime(attempt.submittedAt) }] : []),
          ]}
        />
        {attempt.isLate && <p className="mt-2"><Badge tone="warning">{t.attempt.late}</Badge></p>}
      </Card>
      {attempt.state === "in_progress" ? (
        <LinkButton href={pages.assignment(attempt.assignmentId)} variant="primary">
          {t.attempt.continue}
        </LinkButton>
      ) : !result ? (
        <Notice>{t.attempt.pending}</Notice>
      ) : (
        <Section title={t.attempt.result}>
          {result.scorePercent !== null && result.earnedPoints !== null && (
            <p className="mb-3 font-serif text-2xl">{fmt(t.attempt.score, { earned: result.earnedPoints, max: result.maxPoints, percent: result.scorePercent })}</p>
          )}
          {result.feedback && (
            <Card className="mb-4 border-s-4 border-s-gold">
              <h3 className="font-medium">{t.attempt.feedback}</h3>
              <p className="mt-1 whitespace-pre-line">{result.feedback}</p>
            </Card>
          )}
          {result.itemResults && (
            <ul className="space-y-2">
              {result.itemResults.map((item, index) => (
                <li key={item.itemId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm">
                  {/* Numbered for the reader; the raw item id stays an internal key. */}
                  <span>{fmt(t.attempt.item, { id: index + 1 })}</span>
                  <span className="flex items-center gap-2">
                    {item.correct === true && <Badge tone="strong">{t.attempt.correct}</Badge>}
                    {item.correct === false && <Badge tone="warning">{t.attempt.incorrect}</Badge>}
                    {item.earnedPoints === null ? <Badge>{t.attempt.awaiting}</Badge> : <span>{item.earnedPoints} / {item.maxPoints}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </>
  );
}

function Grading({ attempt, onChanged }: { readonly attempt: AttemptRecord; readonly onChanged: () => void }) {
  const { t, fmt, dateTime } = useWorkspace();
  const { role } = useAuth();
  const roster = useApi<Roster>(api.roster(attempt.classGroupId));
  const learnerName = roster.state.status === "ready" ? roster.state.data.find((row) => row.learnerUid === attempt.learnerUid)?.displayName : null;
  const pending = (attempt.itemResults ?? []).filter((item) => item.earnedPoints === null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState(attempt.feedback ?? "");
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [remediationCount, setRemediationCount] = useState<number | null>(null);
  const action = useAction();

  async function grade(event: FormEvent) {
    event.preventDefault();
    const numeric = Object.fromEntries(pending.map((item) => [item.itemId, Number(scores[item.itemId])]));
    const result = await action.run(api.attempt(attempt.id), "PATCH", { action: "grade", scores: numeric, feedback: feedback || undefined, expectedRevision: attempt.revision });
    if (result.ok) onChanged();
  }

  async function release() {
    const result = await action.run(api.attempt(attempt.id), "PATCH", { action: "release", expectedRevision: attempt.revision });
    if (result.ok) onChanged();
  }

  async function returnForRevision(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(api.attempt(attempt.id), "PATCH", { action: "return", feedback: revisionFeedback, expectedRevision: attempt.revision });
    if (result.ok) onChanged();
  }

  async function applyRemediation() {
    const result = await action.run<{ assigned: unknown[] }>(api.attemptRemediation(attempt.id), "POST");
    if (result.ok) setRemediationCount(result.data.assigned.length);
  }

  const responses = attempt.responses as Record<string, unknown>;

  return (
    <>
      <Card className="mb-6">
        <KeyValues
          items={[
            { label: t.attempt.learner, value: displayName(learnerName, t.common.unnamed) },
            { label: t.common.status, value: <Badge>{t.assessment.state[attempt.state]}</Badge> },
            { label: t.assessment.attempts, value: fmt(t.assessment.attempt, { number: attempt.attemptNumber }) + (attempt.kind === "revision" ? ` (${t.assessment.revision})` : "") },
            ...(attempt.submittedAt ? [{ label: t.common.details, value: dateTime(attempt.submittedAt) }] : []),
            ...(attempt.scorePercent !== null && attempt.earnedPoints !== null ? [{ label: t.attempt.result, value: fmt(t.attempt.score, { earned: attempt.earnedPoints, max: attempt.maxPoints, percent: attempt.scorePercent }) }] : []),
          ]}
        />
        {attempt.isLate && <p className="mt-2"><Badge tone="warning">{t.attempt.late}</Badge></p>}
      </Card>

      {action.failure && (
        <div className="mb-4">
          <FailureNotice failure={action.failure} onRetry={onChanged} />
        </div>
      )}

      <Section title={t.attempt.response}>
        <ul className="space-y-2">
          {(attempt.itemResults ?? []).map((item, index) => (
            <li key={item.itemId} className="rounded-xl border bg-card p-3 text-sm">
              <p className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {fmt(t.attempt.item, { id: index + 1 })}{" "}
                  <bdi dir="ltr" className="font-mono text-xs text-muted-foreground">{item.itemId}</bdi>
                </span>
                <span className="flex items-center gap-2">
                  {item.correct === true && <Badge tone="strong">{t.attempt.correct}</Badge>}
                  {item.correct === false && <Badge tone="warning">{t.attempt.incorrect}</Badge>}
                  {item.earnedPoints === null ? <Badge>{t.attempt.awaiting}</Badge> : <span>{item.earnedPoints} / {item.maxPoints}</span>}
                </span>
              </p>
              <p className="mt-1 whitespace-pre-line break-words" dir="auto">
                {responseText(responses[item.itemId]) || <span className="text-muted-foreground">{t.attempt.noResponse}</span>}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      {attempt.state === "needs_review" && (
        <Section title={t.attempt.grade}>
          <form onSubmit={grade} className="space-y-3 rounded-2xl border bg-card p-4">
            {pending.map((item) => (
              <Field key={item.itemId} label={fmt(t.attempt.pointsFor, { id: (attempt.itemResults ?? []).findIndex((row) => row.itemId === item.itemId) + 1, max: item.maxPoints })} htmlFor={`score-${item.itemId}`}>
                <TextInput
                  id={`score-${item.itemId}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={item.maxPoints}
                  step={0.5}
                  required
                  value={scores[item.itemId] ?? ""}
                  onChange={(e) => setScores((s) => ({ ...s, [item.itemId]: e.target.value }))}
                />
              </Field>
            ))}
            <Field label={t.attempt.feedbackLabel} htmlFor="grade-feedback" optional>
              <TextArea id="grade-feedback" value={feedback} maxLength={10000} onChange={(e) => setFeedback(e.target.value)} />
            </Field>
            <Button type="submit" busy={action.busy}>
              {t.attempt.saveGrade}
            </Button>
          </form>
        </Section>
      )}

      {(attempt.state === "graded" || (attempt.releasedAt !== null && (role === "teacher" || role === "admin"))) && (
        <Section title={t.attempt.actions}>
          <div className="space-y-4 rounded-2xl border bg-card p-4">
            {attempt.state === "graded" && attempt.releasedAt === null && (
              <div className="flex flex-wrap items-center gap-3">
                {/* Releasing is the decisive, irreversible step: the one primary action here. */}
                <Button type="button" busy={action.busy} onClick={() => void release()}>
                  {t.attempt.release}
                </Button>
              </div>
            )}
            {attempt.state === "graded" && (
              <form onSubmit={returnForRevision} className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
                <Field label={t.attempt.revisionFeedback} htmlFor="revision-feedback">
                  <TextArea id="revision-feedback" required value={revisionFeedback} maxLength={10000} onChange={(e) => setRevisionFeedback(e.target.value)} />
                </Field>
                <Button type="submit" variant="outline" busy={action.busy}>
                  {t.attempt.returnForRevision}
                </Button>
              </form>
            )}
            {attempt.releasedAt !== null && (role === "teacher" || role === "admin") && (
              <div className="border-t pt-4 first:border-t-0 first:pt-0">
                <Button type="button" variant="outline" busy={action.busy} onClick={() => void applyRemediation()}>
                  {t.attempt.applyRemediation}
                </Button>
                {remediationCount !== null && (
                  <div className="mt-2">
                    <Notice tone="success">{fmt(t.attempt.remediationApplied, { count: remediationCount })}</Notice>
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>
      )}
    </>
  );
}
