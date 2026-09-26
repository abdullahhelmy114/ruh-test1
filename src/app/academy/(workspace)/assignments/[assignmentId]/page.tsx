"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { answersFromResponses, ItemInput, responsesFromAnswers, type AnswerMap, type ItemAnswer } from "@/components/academy/workspace/assessment-items";
import { useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api, pages } from "@/components/academy/workspace/paths";
import type { AssignmentView } from "@/components/academy/workspace/types";
import {
  ApiView,
  Badge,
  Button,
  Card,
  ConfirmButton,
  DataTable,
  FailureNotice,
  KeyValues,
  LinkButton,
  Notice,
  PageHeader,
  Section,
  TextLink,
} from "@/components/academy/workspace/ui";
import type { AssessmentItem } from "@/lib/academy/assessment/content";

type LearnerView = Extract<AssignmentView, { attempts: readonly unknown[] }>;
type StaffView = Exclude<AssignmentView, LearnerView>;
type AttemptSummary = LearnerView["attempts"][number];

function isLearnerView(view: AssignmentView): view is LearnerView {
  return Array.isArray((view as { attempts?: unknown }).attempts);
}

// An assessment assigned to a class group. Learners receive the answer-free
// projection; graders receive the full content. The server decides which.
export default function AssignmentPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { t } = useWorkspace();
  const { state, reload } = useApi<AssignmentView>(api.assignment(assignmentId));
  return (
    <ApiView state={state} onRetry={reload} notYet={t.states.notYet}>
      {(view) => (
        <>
          <PageHeader back={{ href: pages.classGroup(view.assignment.classGroupId, "work"), label: t.assessment.back }} title={view.assignment.title} />
          {isLearnerView(view) ? <LearnerAssessment view={view} onChanged={reload} /> : <StaffPreview view={view} />}
        </>
      )}
    </ApiView>
  );
}

function LearnerAssessment({ view, onChanged }: { readonly view: LearnerView; readonly onChanged: () => void }) {
  const { t, fmt, percent, sessionTime } = useWorkspace();
  const router = useRouter();
  const inProgress = view.attempts.find((attempt) => attempt.state === "in_progress") ?? null;
  const [current, setCurrent] = useState<{ id: string; revision: number } | null>(inProgress ? { id: inProgress.id, revision: inProgress.revision } : null);
  const [answers, setAnswers] = useState<AnswerMap>(() => answersFromResponses(inProgress?.responses));
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const action = useAction();
  const items = view.content.items;

  async function start() {
    const result = await action.run<AttemptSummary>(api.attempts(view.assignment.id), "POST");
    if (result.ok) {
      setCurrent({ id: result.data.id, revision: result.data.revision });
      setAnswers({});
    }
  }

  async function save() {
    if (!current) return;
    const result = await action.run<AttemptSummary>(api.attempt(current.id), "PATCH", { action: "save", responses: responsesFromAnswers(items, answers), expectedRevision: current.revision });
    if (result.ok) {
      setCurrent({ id: result.data.id, revision: result.data.revision });
      setSavedAt(new Date().toISOString());
    }
  }

  async function submit() {
    if (!current) return;
    const result = await action.run<AttemptSummary>(api.attempt(current.id), "PATCH", { action: "submit", responses: responsesFromAnswers(items, answers), expectedRevision: current.revision });
    if (result.ok) router.push(pages.attempt(result.data.id));
  }

  return (
    <>
      <Card className="mb-6">
        <KeyValues
          items={[
            { label: t.common.opens, value: sessionTime(view.assignment.opensAt) },
            { label: t.common.due, value: view.assignment.dueAt ? sessionTime(view.assignment.dueAt) : "—" },
          ]}
        />
      </Card>

      {action.failure && (
        <div className="mb-4">
          <FailureNotice failure={action.failure} onRetry={onChanged} />
        </div>
      )}

      {current ? (
        <Section title={t.attempt.title}>
          {view.content.instructions && (
            <div className="mb-4">
              <h3 className="font-medium">{t.assessment.instructions}</h3>
              <p className="whitespace-pre-line">{view.content.instructions}</p>
            </div>
          )}
          <ol className="space-y-6">
            {items.map((item, index) => (
              <li key={item.id} className="rounded-md border p-4">
                <p className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium" dir="auto">
                    {index + 1}. {item.prompt}
                  </span>
                  <span className="text-sm text-muted-foreground">{fmt(t.assessment.points, { count: item.points })}</span>
                </p>
                <ItemInput item={item} answer={answers[item.id]} disabled={action.busy} onChange={(answer: ItemAnswer) => setAnswers((a) => ({ ...a, [item.id]: answer }))} />
              </li>
            ))}
          </ol>
          <div className="sticky bottom-0 mt-6 flex flex-wrap items-center gap-2 border-t bg-background py-3">
            <Button type="button" variant="outline" busy={action.busy} onClick={() => void save()}>
              {t.assessment.save}
            </Button>
            <ConfirmButton variant="primary" label={t.assessment.submit} confirmLabel={t.assessment.submitConfirm} busy={action.busy} onConfirm={() => void submit()} />
            {savedAt && <span className="text-sm text-muted-foreground" role="status">{t.common.saved}</span>}
          </div>
        </Section>
      ) : (
        <Section title={t.attempt.title}>
          <Button type="button" busy={action.busy} onClick={() => void start()}>
            {t.assessment.start}
          </Button>
        </Section>
      )}

      <Section title={t.assessment.attempts}>
        <DataTable
          caption={t.assessment.attempts}
          rows={view.attempts}
          rowKey={(row) => row.id}
          empty={t.assessment.noAttempts}
          columns={[
            { key: "number", header: t.assessment.numberColumn, cell: (row) => (row.kind === "revision" ? `${fmt(t.assessment.attempt, { number: row.attemptNumber })} (${t.assessment.revision})` : fmt(t.assessment.attempt, { number: row.attemptNumber })) },
            { key: "state", header: t.common.status, cell: (row) => <Badge tone={row.result ? "strong" : "neutral"}>{t.assessment.state[row.state as keyof typeof t.assessment.state] ?? row.state}</Badge> },
            { key: "result", header: t.attempt.result, cell: (row) => (row.result && row.result.scorePercent !== null ? percent(row.result.scorePercent / 100) : "—") },
            { key: "view", header: <span className="sr-only">{t.assessment.viewAttempt}</span>, cell: (row) => <TextLink href={pages.attempt(row.id)}>{t.assessment.viewAttempt}</TextLink> },
          ]}
        />
      </Section>
    </>
  );
}

/** Graders see the full item content, including answer keys and rubrics. */
function StaffPreview({ view }: { readonly view: StaffView }) {
  const { t, fmt } = useWorkspace();
  return (
    <>
      <p className="mb-4">
        <LinkButton href={pages.classGroup(view.assignment.classGroupId, "review")}>{t.assessment.reviewQueue}</LinkButton>
      </p>
      <Section title={t.assessment.staffPreview}>
        {view.content.instructions && <Notice>{view.content.instructions}</Notice>}
        <ol className="mt-4 space-y-4">
          {view.content.items.map((item, index) => (
            <li key={item.id} className="rounded-md border p-4">
              <p className="font-medium" dir="auto">
                {index + 1}. {item.prompt} <span className="text-sm font-normal text-muted-foreground">({fmt(t.assessment.points, { count: item.points })})</span>
              </p>
              <StaffItemKey item={item} />
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}

function StaffItemKey({ item }: { readonly item: AssessmentItem }) {
  const { t, fmt } = useWorkspace();
  switch (item.type) {
    case "choice":
    case "listening":
      return (
        <ul className="mt-2 space-y-1 ps-4">
          {item.options.map((option, index) => (
            <li key={index} dir="auto">
              {option} {index === item.correctIndex && <Badge tone="strong">{t.assessment.correctOption}</Badge>}
            </li>
          ))}
        </ul>
      );
    case "true_false":
      return <p className="mt-2">{item.correct ? t.assessment.true : t.assessment.false}</p>;
    case "fill_blank":
      return <p className="mt-2">{fmt(t.assessment.acceptedOf, { answers: item.acceptedAnswers.join(" · ") })}</p>;
    case "short_text":
      return item.acceptedAnswers ? <p className="mt-2">{fmt(t.assessment.acceptedOf, { answers: item.acceptedAnswers.join(" · ") })}</p> : null;
    case "word_order":
      return <p className="mt-2" dir="auto">{fmt(t.assessment.correctOrderOf, { order: item.correctOrder.join(" ") })}</p>;
    case "matching":
      return (
        <ul className="mt-2 space-y-1 ps-4">
          {item.pairs.map((pair) => (
            <li key={pair.left} dir="auto">
              <bdi>{pair.left}</bdi>{" "}
              <span aria-hidden="true" className="rtl:hidden">→</span>
              <span aria-hidden="true" className="ltr:hidden">←</span>{" "}
              <bdi>{pair.right}</bdi>
            </li>
          ))}
        </ul>
      );
    case "essay":
    case "oral_response":
      return item.rubric ? <p className="mt-2 whitespace-pre-line">{t.assessment.rubric}: {item.rubric}</p> : null;
  }
}
