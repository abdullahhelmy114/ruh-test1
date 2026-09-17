"use client";

import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { managePages, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { ContentReviewQueue } from "@/components/academy/workspace/admin/types";
import { useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { ApiView, DataTable, PageHeader, TextLink } from "@/components/academy/workspace/ui";

const EDITOR: Readonly<Record<string, (id: string) => string>> = {
  curriculum_version: managePages.curriculumVersion,
  lesson_script_version: managePages.lessonScriptVersion,
  assessment_version: managePages.assessmentVersion,
};

// Governed versions waiting for a reviewer.
export default function ReviewQueuePage() {
  const text = useAdminText();
  const { dateTime } = useWorkspace();
  const { state, reload } = useApi<ContentReviewQueue>(adminApi.reviewQueue);
  return (
    <>
      <PageHeader title={text.reviewQueue.title} />
      <ApiView state={state} onRetry={reload}>
        {(rows) => (
          <DataTable
            caption={text.reviewQueue.title}
            rows={rows}
            rowKey={(row) => `${row.kind}-${row.versionId}`}
            empty={text.reviewQueue.empty}
            columns={[
              { key: "kind", header: text.field.type, cell: (row) => text.reviewQueue.kind[row.kind as keyof typeof text.reviewQueue.kind] ?? row.kind },
              {
                key: "label",
                header: text.field.title,
                cell: (row) => {
                  const href = EDITOR[row.kind];
                  const label = `${row.label ?? "—"} · v${row.versionNumber}`;
                  return href ? <TextLink href={href(row.versionId)}>{label}</TextLink> : label;
                },
              },
              { key: "submitted", header: text.reviewQueue.submitted, cell: (row) => (row.submittedAt ? dateTime(row.submittedAt) : "—") },
            ]}
          />
        )}
      </ApiView>
    </>
  );
}
