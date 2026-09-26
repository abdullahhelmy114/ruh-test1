"use client";

import { useAuth } from "@/lib/firebase/AuthProvider";
import { displayName } from "@/lib/academy/workspace/format";
import { useApi } from "../api";
import { useWorkspace } from "../context";
import { useOpenConversation } from "../messaging";
import { api, pages } from "../paths";
import type { ClassReport, ReviewQueue, Roster } from "../types";
import { ApiView, Badge, Button, DataTable, FailureNotice, TextLink } from "../ui";

/** Roster for the class group's teachers and administrators: names and enrollment state only. */
export function RosterTab({ classGroupId }: { readonly classGroupId: string }) {
  const { t } = useWorkspace();
  const { role } = useAuth();
  const { state, reload } = useApi<Roster>(api.roster(classGroupId));
  const conversation = useOpenConversation();
  return (
    <>
      {conversation.failure && <FailureNotice failure={conversation.failure} />}
      <ApiView state={state} onRetry={reload}>
        {(rows) => (
          <DataTable
            caption={t.classGroup.tabs.roster}
            rows={rows}
            rowKey={(row) => row.enrollmentId}
            empty={t.classGroup.rosterEmpty}
            columns={[
              { key: "name", header: t.common.learner, cell: (row) => displayName(row.displayName, t.common.unnamed) },
              {
                key: "state",
                header: t.common.status,
                cell: (row) => <Badge tone={row.enrollmentState === "active" ? "strong" : "neutral"}>{t.learn.enrollment[row.enrollmentState as keyof typeof t.learn.enrollment] ?? row.enrollmentState}</Badge>,
              },
              {
                key: "actions",
                header: <span className="sr-only">{t.common.details}</span>,
                cell: (row) =>
                  row.enrollmentState === "active" && role === "teacher" ? (
                    <Button type="button" size="sm" variant="outline" busy={conversation.busy} onClick={() => conversation.open(row.learnerUid, classGroupId)}>
                      {t.classGroup.message}
                    </Button>
                  ) : null,
              },
            ]}
          />
        )}
      </ApiView>
    </>
  );
}

export function ReviewTab({ classGroupId }: { readonly classGroupId: string }) {
  const { t, dateTime } = useWorkspace();
  const queue = useApi<ReviewQueue>(api.reviewQueue(classGroupId));
  const roster = useApi<Roster>(api.roster(classGroupId));
  const names = new Map(roster.state.status === "ready" ? roster.state.data.map((row) => [row.learnerUid, row.displayName]) : []);
  return (
    <ApiView state={queue.state} onRetry={queue.reload}>
      {(rows) => (
        <DataTable
          caption={t.classGroup.tabs.review}
          rows={rows}
          rowKey={(row) => row.attemptId}
          empty={t.classGroup.reviewEmpty}
          columns={[
            { key: "assignment", header: t.common.title, cell: (row) => <TextLink href={pages.attempt(row.attemptId)}>{row.assignmentTitle}</TextLink> },
            { key: "learner", header: t.common.learner, cell: (row) => displayName(names.get(row.learnerUid), t.common.unnamed) },
            {
              key: "state",
              header: t.common.status,
              cell: (row) => (
                <span className="flex flex-wrap gap-1">
                  <Badge tone={row.state === "needs_review" ? "warning" : "neutral"}>{row.awaitingRelease ? t.classGroup.awaitingRelease : t.assessment.state[row.state as keyof typeof t.assessment.state] ?? row.state}</Badge>
                  {row.isLate && <Badge tone="warning">{t.classGroup.late}</Badge>}
                </span>
              ),
            },
            { key: "submitted", header: t.common.details, cell: (row) => (row.submittedAt ? dateTime(row.submittedAt) : "—") },
          ]}
        />
      )}
    </ApiView>
  );
}

export function ReportTab({ classGroupId }: { readonly classGroupId: string }) {
  const { t, percent } = useWorkspace();
  const { state, reload } = useApi<ClassReport>(api.report(classGroupId));
  return (
    <ApiView state={state} onRetry={reload}>
      {(rows) => (
        <DataTable
          caption={t.classGroup.tabs.report}
          rows={rows}
          rowKey={(row) => row.learnerUid}
          empty={t.classGroup.reportEmpty}
          columns={[
            { key: "name", header: t.common.learner, cell: (row) => displayName(row.displayName, t.common.unnamed) },
            { key: "attendance", header: t.classGroup.progressAttendance, cell: (row) => (row.attendance.attendedRatio === null ? "—" : percent(row.attendance.attendedRatio)) },
            { key: "average", header: t.classGroup.averageScore, cell: (row) => (row.assessmentAveragePercent === null ? "—" : percent(row.assessmentAveragePercent / 100)) },
            { key: "practice", header: t.classGroup.practiceItems, cell: (row) => row.practiceItemsCompleted },
            { key: "remediation", header: t.classGroup.openRemediation, cell: (row) => row.openRemediation },
          ]}
        />
      )}
    </ApiView>
  );
}
