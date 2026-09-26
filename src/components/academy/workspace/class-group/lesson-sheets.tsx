"use client";

import { useApi } from "../api";
import { useWorkspace } from "../context";
import { api, pages } from "../paths";
import type { SheetAvailabilityList } from "../types";
import { ApiView, Badge, DataTable, Loading, TextLink } from "../ui";

/** Release status of each scheduled lesson. Content opens only from the release instant the server computes. */
export function LessonSheetsTab({ classGroupId, administrator = false }: { readonly classGroupId: string; readonly administrator?: boolean }) {
  const { t, fmt, sessionTime } = useWorkspace();
  const { state, reload } = useApi<SheetAvailabilityList>(api.lessonSheets(classGroupId));
  return (
    <ApiView state={state} onRetry={reload} loading={<Loading shape="list" />}>
      {(rows) => (
        <DataTable
          caption={t.classGroup.tabs.lessons}
          rows={[...rows].sort((a, b) => (a.firstSessionStartsAt ?? "").localeCompare(b.firstSessionStartsAt ?? ""))}
          rowKey={(row) => row.lessonId}
          empty={t.classGroup.noLessons}
          columns={[
            {
              key: "lesson",
              header: t.common.lesson,
              // Linked means open; plain text plus a date says when it opens.
              // Administrators keep pre-release visibility (the server enforces it either way).
              cell: (row) =>
                row.availability.status === "released" || administrator ? (
                  <TextLink href={pages.lessonSheet(classGroupId, row.lessonId)}>{row.lessonTitle}</TextLink>
                ) : (
                  row.lessonTitle
                ),
            },
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
          ]}
        />
      )}
    </ApiView>
  );
}
