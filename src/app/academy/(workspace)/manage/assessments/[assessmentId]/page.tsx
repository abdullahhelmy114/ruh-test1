"use client";

import { useParams } from "next/navigation";
import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { managePages, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { AssessmentDetail } from "@/components/academy/workspace/admin/types";
import { VersionList } from "@/components/academy/workspace/admin/versions";
import { useApi } from "@/components/academy/workspace/api";
import { ApiView, Badge, PageHeader } from "@/components/academy/workspace/ui";

// An assessment and its governed versions.
export default function AssessmentPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const text = useAdminText();
  const { state, reload } = useApi<AssessmentDetail>(adminApi.assessment(assessmentId));
  return (
    <ApiView state={state} onRetry={reload}>
      {({ assessment, versions }) => (
        <>
          <PageHeader back={{ href: managePages.course(assessment.courseId, "assessments"), label: text.course.tabs.assessments }} title={assessment.title} intro={<Badge>{text.assessmentEditor.mode[assessment.mode]}</Badge>} />
          <VersionList versions={versions} href={managePages.assessmentVersion} createUrl={adminApi.assessment(assessment.id)} onCreated={reload} />
        </>
      )}
    </ApiView>
  );
}
