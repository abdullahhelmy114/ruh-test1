"use client";

import { useParams } from "next/navigation";
import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { BlockEditor } from "@/components/academy/workspace/admin/editors";
import { managePages, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { LessonScriptVersion } from "@/components/academy/workspace/admin/types";
import { MUTABLE_STATES, VersionHeader } from "@/components/academy/workspace/admin/versions";
import { useApi } from "@/components/academy/workspace/api";
import { ApiView, PageHeader, Section } from "@/components/academy/workspace/ui";
import { lessonContentToForms } from "@/lib/academy/workspace/editor-forms";

// Lesson Script authoring: typed blocks, editable only while the version is a
// draft (published content is immutable), then review and publication.
export default function LessonScriptVersionPage() {
  const { versionId } = useParams<{ versionId: string }>();
  const text = useAdminText();
  const { state, reload } = useApi<LessonScriptVersion>(adminApi.lessonScriptVersion(versionId));
  return (
    <ApiView state={state} onRetry={reload}>
      {({ version, content }) => (
        <>
          <PageHeader back={{ href: managePages.reviewQueue, label: text.nav.reviewQueue }} title={`${text.course.script} v${version.versionNumber}`} />
          <VersionHeader version={version} url={adminApi.lessonScriptVersion(version.id)} onChanged={reload} />
          <Section title={text.script.blocks}>
            <BlockEditor
              key={version.revision}
              initial={lessonContentToForms(content)}
              editable={MUTABLE_STATES.includes(version.state)}
              url={adminApi.lessonScriptVersion(version.id)}
              revision={version.revision}
              onSaved={reload}
            />
          </Section>
        </>
      )}
    </ApiView>
  );
}
