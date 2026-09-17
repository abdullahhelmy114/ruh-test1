"use client";

import { useApi } from "../api";
import { useWorkspace } from "../context";
import { api, pages } from "../paths";
import type { AssignmentList } from "../types";
import { ApiView, Badge, DataTable, TextLink } from "../ui";

type Entry = AssignmentList[number];
type LearnerEntry = Extract<Entry, { attempts: unknown }>;
type StaffEntry = Extract<Entry, { attemptsByState: unknown }>;

export function AssignmentsTab({ classGroupId }: { readonly classGroupId: string }) {
  const { t } = useWorkspace();
  const { state, reload } = useApi<AssignmentList>(api.assignments(classGroupId));
  return (
    <ApiView state={state} onRetry={reload}>
      {(list) => {
        const learner = list.filter((entry): entry is LearnerEntry => "attempts" in entry);
        const staff = list.filter((entry): entry is StaffEntry => "attemptsByState" in entry);
        return learner.length > 0 || staff.length === 0 ? <LearnerAssignments rows={learner} /> : <StaffAssignments rows={staff} />;
      }}
    </ApiView>
  );
}

function LearnerAssignments({ rows }: { readonly rows: readonly LearnerEntry[] }) {
  const { t, sessionTime } = useWorkspace();
  return (
    <DataTable
      caption={t.classGroup.tabs.work}
      rows={rows}
      rowKey={(row) => row.assignment.id}
      empty={t.classGroup.assignmentsEmpty}
      columns={[
        { key: "title", header: t.common.title, cell: (row) => <TextLink href={pages.assignment(row.assignment.id)}>{row.assignment.title}</TextLink> },
        { key: "opens", header: t.common.opens, cell: (row) => sessionTime(row.assignment.opensAt) },
        { key: "due", header: t.common.due, cell: (row) => (row.assignment.dueAt ? sessionTime(row.assignment.dueAt) : "—") },
        {
          key: "status",
          header: t.common.status,
          cell: (row) => {
            const latest = [...row.attempts].sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
            if (!latest) return <Badge>{t.classGroup.assessmentStatus.not_started}</Badge>;
            return (
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone={latest.result ? "strong" : "neutral"}>{t.assessment.state[latest.state as keyof typeof t.assessment.state] ?? latest.state}</Badge>
                <TextLink href={pages.attempt(latest.id)}>{t.assessment.viewAttempt}</TextLink>
              </span>
            );
          },
        },
      ]}
    />
  );
}

function StaffAssignments({ rows }: { readonly rows: readonly StaffEntry[] }) {
  const { t, sessionTime } = useWorkspace();
  return (
    <DataTable
      caption={t.classGroup.tabs.work}
      rows={rows}
      rowKey={(row) => row.assignment.id}
      empty={t.classGroup.assignmentsEmpty}
      columns={[
        { key: "title", header: t.common.title, cell: (row) => <TextLink href={pages.assignment(row.assignment.id)}>{row.assignment.title}</TextLink> },
        { key: "state", header: t.common.status, cell: (row) => <Badge>{row.assignment.state}</Badge> },
        { key: "due", header: t.common.due, cell: (row) => (row.assignment.dueAt ? sessionTime(row.assignment.dueAt) : "—") },
        {
          key: "counts",
          header: t.assessment.counts,
          cell: (row) => (
            <span className="flex flex-wrap gap-1">
              {Object.entries(row.attemptsByState).map(([state, count]) => (
                <Badge key={state}>
                  {t.assessment.state[state as keyof typeof t.assessment.state] ?? state}: {count}
                </Badge>
              ))}
            </span>
          ),
        },
      ]}
    />
  );
}
