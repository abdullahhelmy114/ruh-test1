"use client";

import { useParams } from "next/navigation";
import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { ItemEditor } from "@/components/academy/workspace/admin/editors";
import { managePages, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { AssessmentVersion } from "@/components/academy/workspace/admin/types";
import { MUTABLE_STATES, VersionHeader } from "@/components/academy/workspace/admin/versions";
import { useApi } from "@/components/academy/workspace/api";
import { ApiView, PageHeader, Section } from "@/components/academy/workspace/ui";
import { assessmentContentToForms } from "@/lib/academy/workspace/editor-forms";

// Assessment authoring: items with answer keys and rubrics (never sent to
// learners), editable only while the version is a draft.
export default function AssessmentVersionPage() {
  const { versionId } = useParams<{ versionId: string }>();
  const text = useAdminText();
  const { state, reload } = useApi<AssessmentVersion>(adminApi.assessmentVersion(versionId));
  return (
    <ApiView state={state} onRetry={reload}>
      {({ version, content }) => {
        const forms = assessmentContentToForms(content);
        return (
          <>
            <PageHeader back={{ href: managePages.assessment(version.parentId), label: text.course.tabs.assessments }} title={`${text.assessmentEditor.versions} v${version.versionNumber}`} />
            <VersionHeader version={version} url={adminApi.assessmentVersion(version.id)} onChanged={reload} />
            <Section title={text.assessmentEditor.items}>
              <ItemEditor
                key={version.revision}
                initialInstructions={forms.instructions}
                initial={forms.items}
                editable={MUTABLE_STATES.includes(version.state)}
                url={adminApi.assessmentVersion(version.id)}
                revision={version.revision}
                onSaved={reload}
              />
            </Section>
          </>
        );
      }}
    </ApiView>
  );
}
