"use client";

import { useParams } from "next/navigation";
import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { OutlineEditor } from "@/components/academy/workspace/admin/editors";
import { managePages, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { CurriculumVersionDetail } from "@/components/academy/workspace/admin/types";
import { MUTABLE_STATES, VersionHeader } from "@/components/academy/workspace/admin/versions";
import { useApi } from "@/components/academy/workspace/api";
import { ApiView, PageHeader, Section } from "@/components/academy/workspace/ui";
import { outlineToForms } from "@/lib/academy/workspace/editor-forms";

// A curriculum version: outline editing while it is a draft, then review and publication.
export default function CurriculumVersionPage() {
  const { versionId } = useParams<{ versionId: string }>();
  const text = useAdminText();
  const { state, reload } = useApi<CurriculumVersionDetail>(adminApi.curriculumVersion(versionId));
  return (
    <ApiView state={state} onRetry={reload}>
      {({ version, outline }) => (
        <>
          <PageHeader back={{ href: managePages.catalog, label: text.catalog.title }} title={`${text.course.tabs.curriculum} v${version.versionNumber}`} />
          <VersionHeader version={version} url={adminApi.curriculumVersion(version.id)} onChanged={reload} />
          <Section title={text.course.tabs.curriculum}>
            <OutlineEditor
              key={version.revision}
              initial={outlineToForms(outline)}
              editable={MUTABLE_STATES.includes(version.state)}
              url={adminApi.curriculumVersion(version.id)}
              revision={version.revision}
              onSaved={reload}
            />
          </Section>
        </>
      )}
    </ApiView>
  );
}
