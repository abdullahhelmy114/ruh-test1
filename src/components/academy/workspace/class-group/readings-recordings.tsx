"use client";

import { useApi } from "../api";
import { useWorkspace } from "../context";
import { api, pages } from "../paths";
import type { Readings, Recordings } from "../types";
import { ApiView, Badge, DataTable, LinkButton } from "../ui";

export function ReadingsTab({ classGroupId }: { readonly classGroupId: string }) {
  const { t, fmt } = useWorkspace();
  const { state, reload } = useApi<Readings>(api.readings(classGroupId));
  return (
    <ApiView state={state} onRetry={reload}>
      {(rows) => (
        <DataTable
          caption={t.classGroup.tabs.readings}
          rows={rows}
          rowKey={(row) => row.resourceId}
          empty={t.classGroup.readingsEmpty}
          columns={[
            {
              key: "book",
              header: t.common.title,
              cell: (row) => (
                <span>
                  <span className="font-medium">{row.book.title}</span>
                  {row.book.author && <span className="block text-sm text-muted-foreground">{row.book.author}</span>}
                  {row.note && <span className="block text-sm">{row.note}</span>}
                </span>
              ),
            },
            { key: "purpose", header: t.common.status, cell: (row) => <Badge tone={row.purpose === "required" ? "strong" : "neutral"}>{t.classGroup.purpose[row.purpose]}</Badge> },
            { key: "pages", header: t.classGroup.wholeBook, cell: (row) => (row.pages ? fmt(t.classGroup.pages, { from: row.pages.from, to: row.pages.to ?? row.pages.from }) : t.classGroup.wholeBook) },
            { key: "read", header: <span className="sr-only">{t.classGroup.read}</span>, cell: (row) => <LinkButton href={pages.book(row.book.id, row.pages?.from)}>{t.classGroup.read}</LinkButton> },
          ]}
        />
      )}
    </ApiView>
  );
}

export function RecordingsTab({ classGroupId }: { readonly classGroupId: string }) {
  const { t, fmt, date } = useWorkspace();
  const { state, reload } = useApi<Recordings>(api.recordings(classGroupId));
  return (
    <ApiView state={state} onRetry={reload}>
      {(rows) => (
        <DataTable
          caption={t.classGroup.tabs.recordings}
          rows={rows}
          rowKey={(row) => row.id}
          empty={t.classGroup.recordingsEmpty}
          columns={[
            { key: "title", header: t.common.title, cell: (row) => row.title },
            { key: "published", header: t.common.status, cell: (row) => (row.state ? <Badge>{t.recordings.state[row.state as keyof typeof t.recordings.state] ?? row.state}</Badge> : row.publishedAt ? date(row.publishedAt) : "—") },
            {
              key: "availability",
              header: t.common.details,
              cell: (row) =>
                row.unavailableReason ? (
                  <span className="text-sm text-muted-foreground">{t.classGroup.unavailableReason[row.unavailableReason]}</span>
                ) : row.availableUntil ? (
                  <span className="text-sm">{fmt(t.classGroup.availableUntil, { date: date(row.availableUntil) })}</span>
                ) : null,
            },
            { key: "watch", header: <span className="sr-only">{t.classGroup.watch}</span>, cell: (row) => (row.mediaUrl ? <LinkButton href={pages.recording(row.id)}>{t.classGroup.watch}</LinkButton> : null) },
          ]}
        />
      )}
    </ApiView>
  );
}
