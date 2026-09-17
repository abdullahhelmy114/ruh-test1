"use client";

import { useApi } from "../api";
import { useWorkspace } from "../context";
import { api, pages } from "../paths";
import type { MyAttendance } from "../types";
import { ApiView, Badge, DataTable, Notice, TextLink } from "../ui";

/** A learner's own attendance in this class group. Teachers record attendance on each session page. */
export function MyAttendanceTab({ classGroupId }: { readonly classGroupId: string }) {
  const { t, fmt, sessionTime, locale } = useWorkspace();
  const { state, reload } = useApi<MyAttendance>(api.myAttendance(classGroupId));
  return (
    <ApiView state={state} onRetry={reload}>
      {(data) => (
        <>
          {data.summary.recordedSessions > 0 && (
            <Notice>
              {fmt(t.classGroup.attendanceSummary, { attended: data.summary.attendedSessions, recorded: data.summary.recordedSessions })}
            </Notice>
          )}
          <div className="mt-4">
            <DataTable
              caption={t.classGroup.myAttendance}
              rows={data.records}
              rowKey={(row) => row.sessionId}
              empty={t.classGroup.attendanceEmpty}
              columns={[
                { key: "when", header: t.session.when, cell: (row) => <TextLink href={pages.session(row.sessionId)}>{sessionTime(row.sessionStartsAt)}</TextLink> },
                { key: "lesson", header: t.common.lesson, cell: (row) => row.lessonTitle },
                {
                  key: "mark",
                  header: t.session.myMark,
                  cell: (row) => (
                    <Badge tone={row.countsAsAttended ? "strong" : "warning"}>{data.vocabulary?.marks.find((mark) => mark.code === row.markCode)?.labels[locale] ?? row.markCode}</Badge>
                  ),
                },
              ]}
            />
          </div>
        </>
      )}
    </ApiView>
  );
}
