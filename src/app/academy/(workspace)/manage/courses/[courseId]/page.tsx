"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { StateBadge } from "@/components/academy/workspace/admin/common";
import { CourseAssessments, CourseClassGroups, CourseCurriculum, CourseDetails, CourseOffers, CourseReadings, CourseRemediationRules } from "@/components/academy/workspace/admin/course";
import { managePages, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { CourseDetail } from "@/components/academy/workspace/admin/types";
import { useApi } from "@/components/academy/workspace/api";
import { ApiView, Loading, PageHeader, TabPanel, Tabs } from "@/components/academy/workspace/ui";

type TabKey = "details" | "curriculum" | "assessments" | "readings" | "remediation" | "classGroups" | "offers";
const TABS: readonly TabKey[] = ["details", "curriculum", "assessments", "readings", "remediation", "classGroups", "offers"];

export default function CoursePage() {
  return (
    <Suspense fallback={<Loading />}>
      <CourseAdmin />
    </Suspense>
  );
}

function CourseAdmin() {
  const { courseId } = useParams<{ courseId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const text = useAdminText();
  const { state, reload } = useApi<CourseDetail>(adminApi.course(courseId));
  const requested = search.get("tab") as TabKey | null;
  const current: TabKey = requested && TABS.includes(requested) ? requested : "details";

  return (
    <ApiView state={state} onRetry={reload}>
      {(detail) => (
        <>
          <PageHeader back={{ href: managePages.catalog, label: text.catalog.title }} title={detail.course.title} intro={<StateBadge state={detail.course.status} deleted={detail.course.deletedAt !== null} />} />
          <Tabs
            label={detail.course.title}
            tabs={TABS.map((key) => ({ key, label: text.course.tabs[key] }))}
            current={current}
            onChange={(key) => router.replace(managePages.course(courseId, key === "details" ? undefined : key), { scroll: false })}
          />
          <TabPanel tabKey={current}>
            {current === "details" && <CourseDetails detail={detail} onChanged={reload} />}
            {current === "curriculum" && <CourseCurriculum courseId={courseId} />}
            {current === "assessments" && <CourseAssessments courseId={courseId} />}
            {current === "readings" && <CourseReadings courseId={courseId} />}
            {current === "remediation" && <CourseRemediationRules courseId={courseId} />}
            {current === "classGroups" && <CourseClassGroups courseId={courseId} />}
            {current === "offers" && <CourseOffers courseId={courseId} />}
          </TabPanel>
        </>
      )}
    </ApiView>
  );
}
