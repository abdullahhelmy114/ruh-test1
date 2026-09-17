"use client";

import { useApi } from "../api";
import { useWorkspace } from "../context";
import { api, pages } from "../paths";
import type { SheetAvailabilityList } from "../types";
import { ApiView, Badge, DataTable, LinkButton } from "../ui";

/** Release status of each scheduled lesson. Content opens only from the release instant the server computes. */
export function LessonSheetsTab({ classGroupId, administrator = false }: { readonly classGroupId: string; readonly administrator?: boolean }) {
  const { t, fmt, sessionTime } = useWorkspace();
  const { state, reload } = useApi<SheetAvailabilityList>(api.lessonSheets(classGroupId));
  return (
    <ApiView state={state} onRetry={reload}>
      {(rows) => (
        <DataTable
          caption={t.classGroup.tabs.lessons}
          rows={[...rows].sort((a, b) => (a.firstSessionStartsAt ?? "").localeCompare(b.firstSessionStartsAt ?? ""))}
          rowKey={(row) => row.lessonId}
          empty={t.classGroup.noLessons}
          columns={[
            { key: "lesson", header: t.common.lesson, cell: (row) => row.lessonTitle },
            { key: "session", header: t.common.session, cell: (row) => (row.firstSessionStartsAt ? sessionTime(row.firstSessionStartsAt) : "—") },
            {
              key: "status",
              header: t.common.status,
              cell: (row) =>
                row.availability.status === "released" ? (
                  <Badge tone="strong">{t.classGroup.sheetStatus.released}</Badge>
                ) : row.availability.status === "scheduled" ? (
                  <Badge>{fmt(t.classGroup.sheetStatus.scheduled, { date: sessionTime(row.availability.releaseAt) })}</Badge>
                ) : (
                  <Badge>{t.classGroup.sheetStatus.no_session}</Badge>
                ),
            },
            {
              key: "open",
              header: <span className="sr-only">{t.common.open}</span>,
              // Administrators keep administrative visibility before release (enforced by the server either way).
              cell: (row) =>
                row.availability.status === "released" || administrator ? (
                  <LinkButton href={pages.lessonSheet(classGroupId, row.lessonId)}>{t.classGroup.openSheet}</LinkButton>
                ) : null,
            },
          ]}
        />
      )}
    </ApiView>
  );
}
