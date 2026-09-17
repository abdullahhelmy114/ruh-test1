"use client";

import { useState } from "react";
import { displayName } from "@/lib/academy/workspace/format";
import { useApi } from "../api";
import { useWorkspace } from "../context";
import { api } from "../paths";
import type { ProgressView, Roster } from "../types";
import { ApiView, Badge, Card, DataTable, EmptyState, Field, KeyValues, Notice, SelectInput } from "../ui";

/** Learners see their own progress. Staff choose a learner of the class group. */
export function ProgressTab({ classGroupId, staff }: { readonly classGroupId: string; readonly staff: boolean }) {
  return staff ? <StaffProgress classGroupId={classGroupId} /> : <ProgressFor url={api.progress(classGroupId)} />;
}

function StaffProgress({ classGroupId }: { readonly classGroupId: string }) {
  const { t } = useWorkspace();
  const roster = useApi<Roster>(api.roster(classGroupId));
  const [learnerUid, setLearnerUid] = useState("");
  return (
    <ApiView state={roster.state} onRetry={roster.reload}>
      {(rows) =>
        rows.length === 0 ? (
          <EmptyState>{t.classGroup.rosterEmpty}</EmptyState>
        ) : (
          <>
            <div className="mb-4 max-w-sm">
              <Field label={t.classGroup.chooseLearner} htmlFor="progress-learner">
                <SelectInput id="progress-learner" value={learnerUid} onChange={(event) => setLearnerUid(event.target.value)}>
                  <option value="">{t.common.choose}</option>
                  {rows.map((row) => (
                    <option key={row.enrollmentId} value={row.learnerUid}>
                      {displayName(row.displayName, t.common.unnamed)}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>
            {learnerUid && <ProgressFor key={learnerUid} url={api.progress(classGroupId, learnerUid)} />}
          </>
        )
      }
    </ApiView>
  );
}

export function ProgressFor({ url }: { readonly url: string }) {
  const { t, fmt, percent } = useWorkspace();
  const { state, reload } = useApi<ProgressView>(url);
  return (
    <ApiView state={state} onRetry={reload}>
      {(data) => {
        const { progress, completion } = data;
        return (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card>
                <h3 className="text-sm text-muted-foreground">{t.classGroup.progressLessons}</h3>
                <p className="text-2xl font-semibold">
                  {progress.lessons.completed} / {progress.lessons.total}
                </p>
              </Card>
              <Card>
                <h3 className="text-sm text-muted-foreground">{t.classGroup.progressAttendance}</h3>
                <p className="text-2xl font-semibold">{progress.attendance.attendedRatio === null ? "—" : percent(progress.attendance.attendedRatio)}</p>
                <p className="text-sm text-muted-foreground">
                  {fmt(t.classGroup.attendanceSummary, { attended: progress.attendance.attendedSessions, recorded: progress.attendance.recordedSessions })}
                </p>
              </Card>
            </div>

            <div>
              <h3 className="mb-2 font-semibold">{t.classGroup.progressAssessments}</h3>
              <DataTable
                caption={t.classGroup.progressAssessments}
                rows={progress.assessments}
                rowKey={(row) => row.assignmentId}
                empty={t.classGroup.assignmentsEmpty}
                columns={[
                  { key: "title", header: t.common.title, cell: (row) => row.title },
                  { key: "status", header: t.common.status, cell: (row) => <Badge>{t.classGroup.assessmentStatus[row.status]}</Badge> },
                  { key: "best", header: t.classGroup.bestScore, cell: (row) => (row.bestScorePercent === null ? "—" : `${row.bestScorePercent}%`) },
                ]}
              />
            </div>

            <div>
              <h3 className="mb-2 font-semibold">{t.classGroup.completion}</h3>
              {!completion.configured ? (
                <Notice>{t.classGroup.completionUnconfigured}</Notice>
              ) : (
                <Card>
                  <p className="mb-3 font-medium">{completion.evaluation.eligible ? t.classGroup.eligible : t.classGroup.notEligible}</p>
                  <KeyValues
                    items={completion.evaluation.checks.map((check) => ({
                      label: t.classGroup.criterion[check.criterion],
                      value: <Badge tone={check.met ? "strong" : "warning"}>{check.met ? t.classGroup.met : t.classGroup.notMet}</Badge>,
                    }))}
                  />
                </Card>
              )}
            </div>
          </div>
        );
      }}
    </ApiView>
  );
}
