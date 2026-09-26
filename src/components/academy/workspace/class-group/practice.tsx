"use client";

import { useState, type FormEvent } from "react";
import { displayName } from "@/lib/academy/workspace/format";
import { useAction, useApi } from "../api";
import { useWorkspace } from "../context";
import { api, pages } from "../paths";
import type { ContentList, PracticeResults, Remediation, Roster } from "../types";
import {
  ApiView,
  Badge,
  Button,
  DataTable,
  EmptyState,
  FailureNotice,
  Field,
  ReasonField,
  Section,
  SelectInput,
  TextInput,
  TextLink,
} from "../ui";

export function PracticeTab({ classGroupId, staff }: { readonly classGroupId: string; readonly staff: boolean }) {
  const { t } = useWorkspace();
  const content = useApi<ContentList>(api.content(classGroupId));
  return (
    <ApiView state={content.state} onRetry={content.reload}>
      {(items) => {
        const titles = new Map(items.map((item) => [item.itemId, item.title]));
        return (
          <>
            <Section title={t.classGroup.tabs.practice}>
              {items.length === 0 ? (
                <EmptyState>{t.classGroup.practiceEmpty}</EmptyState>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={t.classGroup.tabs.practice}>
                  {items.map((row) => (
                    <li key={row.linkId} className="rounded-2xl border bg-card p-4 transition-colors hover:bg-accent/50">
                      <p className="flex flex-wrap items-center gap-2">
                        <Badge>{t.classGroup.contentKind[row.kind as keyof typeof t.classGroup.contentKind] ?? row.kind}</Badge>
                        {row.purpose !== "practice" && (
                          <Badge tone="warning">{t.classGroup.contentPurpose[row.purpose as keyof typeof t.classGroup.contentPurpose] ?? row.purpose}</Badge>
                        )}
                      </p>
                      <p className="mt-2">
                        <TextLink href={pages.content(classGroupId, row.itemId)}>{row.title}</TextLink>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            {staff ? (
              <StaffPractice classGroupId={classGroupId} titles={titles} remediationItems={items.filter((item) => item.purpose === "remediation")} />
            ) : (
              <>
                <Section title={t.classGroup.remediation}>
                  <RemediationList url={api.remediation(classGroupId)} classGroupId={classGroupId} titles={titles} actingAsLearner />
                </Section>
                <Section title={t.classGroup.results}>
                  <ResultsList url={api.practiceResults(classGroupId)} titles={titles} />
                </Section>
              </>
            )}
          </>
        );
      }}
    </ApiView>
  );
}

function StaffPractice({
  classGroupId,
  titles,
  remediationItems,
}: {
  readonly classGroupId: string;
  readonly titles: ReadonlyMap<string, string>;
  readonly remediationItems: ContentList;
}) {
  const { t } = useWorkspace();
  const roster = useApi<Roster>(api.roster(classGroupId));
  const [learnerUid, setLearnerUid] = useState("");
  const [nonce, setNonce] = useState(0);
  return (
    <ApiView state={roster.state} onRetry={roster.reload}>
      {(rows) =>
        rows.length === 0 ? (
          <EmptyState>{t.classGroup.rosterEmpty}</EmptyState>
        ) : (
          <>
            <div className="mb-4 max-w-sm">
              <Field label={t.classGroup.chooseLearner} htmlFor="practice-learner">
                <SelectInput id="practice-learner" value={learnerUid} onChange={(event) => setLearnerUid(event.target.value)}>
                  <option value="">{t.common.choose}</option>
                  {rows.map((row) => (
                    <option key={row.enrollmentId} value={row.learnerUid}>
                      {displayName(row.displayName, t.common.unnamed)}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>
            {learnerUid && (
              <div key={`${learnerUid}-${nonce}`}>
                <Section title={t.classGroup.remediation}>
                  <AssignRemediation classGroupId={classGroupId} learnerUid={learnerUid} items={remediationItems} onAssigned={() => setNonce((n) => n + 1)} />
                  <div className="mt-4">
                    <RemediationList url={api.remediation(classGroupId, learnerUid)} classGroupId={classGroupId} titles={titles} actingAsLearner={false} />
                  </div>
                </Section>
                <Section title={t.classGroup.results}>
                  <ResultsList url={api.practiceResults(classGroupId, learnerUid)} titles={titles} />
                </Section>
              </div>
            )}
          </>
        )
      }
    </ApiView>
  );
}

function AssignRemediation({
  classGroupId,
  learnerUid,
  items,
  onAssigned,
}: {
  readonly classGroupId: string;
  readonly learnerUid: string;
  readonly items: ContentList;
  readonly onAssigned: () => void;
}) {
  const { t } = useWorkspace();
  const [itemId, setItemId] = useState("");
  const [note, setNote] = useState("");
  const action = useAction();
  if (items.length === 0) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    // targetLearnerUid names the learner receiving the work; the assigning teacher is the signed-in caller.
    const result = await action.run(api.remediation(classGroupId), "POST", { targetLearnerUid: learnerUid, itemId, note: note || undefined });
    if (result.ok) {
      setItemId("");
      setNote("");
      onAssigned();
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field label={t.classGroup.remediationItem} htmlFor="remediation-item">
        <SelectInput id="remediation-item" required value={itemId} onChange={(event) => setItemId(event.target.value)}>
          <option value="">{t.common.choose}</option>
          {items.map((item) => (
            <option key={item.itemId} value={item.itemId}>
              {item.title}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label={t.classGroup.note} htmlFor="remediation-note" optional>
        <TextInput id="remediation-note" value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <Button type="submit" busy={action.busy}>
        {t.classGroup.assignRemediation}
      </Button>
      {action.failure && (
        <div className="sm:col-span-3">
          <FailureNotice failure={action.failure} />
        </div>
      )}
    </form>
  );
}

function RemediationList({
  url,
  classGroupId,
  titles,
  actingAsLearner,
}: {
  readonly url: string;
  readonly classGroupId: string;
  readonly titles: ReadonlyMap<string, string>;
  readonly actingAsLearner: boolean;
}) {
  const { t, date } = useWorkspace();
  const { state, reload } = useApi<Remediation>(url);
  return (
    <ApiView state={state} onRetry={reload}>
      {(rows) =>
        rows.length === 0 ? (
          <EmptyState>{t.classGroup.remediationEmpty}</EmptyState>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.id} className="rounded-xl border bg-card p-3">
                <p className="flex flex-wrap items-center gap-2">
                  <TextLink href={pages.content(classGroupId, row.itemId)}>{titles.get(row.itemId) ?? t.classGroup.remediationItem}</TextLink>
                  <Badge tone={row.state === "assigned" ? "warning" : "neutral"}>{t.classGroup.remediationState[row.state]}</Badge>
                  <span className="text-sm text-muted-foreground">{date(row.assignedAt)}</span>
                </p>
                {row.note && <p className="mt-1 text-sm">{row.note}</p>}
                {row.state === "assigned" && <ResolveRemediation assignmentId={row.id} revision={row.revision} actingAsLearner={actingAsLearner} onResolved={reload} />}
              </li>
            ))}
          </ul>
        )
      }
    </ApiView>
  );
}

function ResolveRemediation({
  assignmentId,
  revision,
  actingAsLearner,
  onResolved,
}: {
  readonly assignmentId: string;
  readonly revision: number;
  readonly actingAsLearner: boolean;
  readonly onResolved: () => void;
}) {
  const { t } = useWorkspace();
  const action = useAction();
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");

  async function resolve(to: "completed" | "dismissed") {
    const result = await action.run(api.remediationAssignment(assignmentId), "PATCH", { to, reason: to === "dismissed" ? reason : undefined, expectedRevision: revision });
    if (result.ok) onResolved();
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" busy={action.busy} onClick={() => resolve("completed")}>
          {t.classGroup.markDone}
        </Button>
        {!actingAsLearner && !dismissing && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setDismissing(true)}>
            {t.classGroup.dismiss}
          </Button>
        )}
      </div>
      {dismissing && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void resolve("dismissed");
          }}
          className="space-y-2"
        >
          <ReasonField id={`dismiss-${assignmentId}`} value={reason} onChange={setReason} />
          <Button type="submit" size="sm" variant="danger" busy={action.busy}>
            {t.classGroup.dismiss}
          </Button>
        </form>
      )}
      {action.failure && <FailureNotice failure={action.failure} />}
    </div>
  );
}

function ResultsList({ url, titles }: { readonly url: string; readonly titles: ReadonlyMap<string, string> }) {
  const { t, dateTime } = useWorkspace();
  const { state, reload } = useApi<PracticeResults>(url);
  return (
    <ApiView state={state} onRetry={reload}>
      {(rows) => (
        <DataTable
          caption={t.classGroup.results}
          rows={rows}
          rowKey={(row) => row.id}
          empty={t.classGroup.resultsEmpty}
          columns={[
            { key: "item", header: t.classGroup.remediationItem, cell: (row) => titles.get(row.itemId) ?? "—" },
            { key: "score", header: t.attempt.result, cell: (row) => `${row.scorePercent}%` },
            { key: "when", header: t.common.details, cell: (row) => dateTime(row.completedAt) },
          ]}
        />
      )}
    </ApiView>
  );
}
