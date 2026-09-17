"use client";

import { useParams } from "next/navigation";
import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { managePages, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { LessonScript } from "@/components/academy/workspace/admin/types";
import { VersionList } from "@/components/academy/workspace/admin/versions";
import { useApi } from "@/components/academy/workspace/api";
import { ApiView, EmptyState, PageHeader } from "@/components/academy/workspace/ui";

// A lesson's Lesson Script and its versions. Only administrators author
// canonical content; teachers never reach these endpoints.
export default function LessonScriptPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const text = useAdminText();
  const { state, reload } = useApi<LessonScript>(adminApi.lessonScript(lessonId));
  return (
    <ApiView state={state} onRetry={reload}>
      {({ script, versions }) => (
        <>
          <PageHeader back={{ href: managePages.catalog, label: text.catalog.title }} title={text.course.script} />
          {!script && <EmptyState>{text.script.noScript}</EmptyState>}
          <VersionList versions={versions} href={managePages.lessonScriptVersion} createUrl={adminApi.lessonScript(lessonId)} onCreated={reload} />
        </>
      )}
    </ApiView>
  );
}
