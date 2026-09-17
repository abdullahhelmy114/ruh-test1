"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { AnnouncementFeed } from "@/components/academy/workspace/announcements";
import { useApi } from "@/components/academy/workspace/api";
import { AssignmentsTab } from "@/components/academy/workspace/class-group/assignments";
import { MyAttendanceTab } from "@/components/academy/workspace/class-group/attendance";
import { LessonSheetsTab } from "@/components/academy/workspace/class-group/lesson-sheets";
import { OverviewTab } from "@/components/academy/workspace/class-group/overview";
import { PracticeTab } from "@/components/academy/workspace/class-group/practice";
import { ProgressTab } from "@/components/academy/workspace/class-group/progress";
import { ReadingsTab, RecordingsTab } from "@/components/academy/workspace/class-group/readings-recordings";
import { ReportTab, ReviewTab, RosterTab } from "@/components/academy/workspace/class-group/staff";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api, pages } from "@/components/academy/workspace/paths";
import type { ClassGroupDetail } from "@/components/academy/workspace/types";
import { ApiView, Badge, Loading, PageHeader, TabPanel, Tabs, type TabItem } from "@/components/academy/workspace/ui";

type TabKey = "overview" | "lessons" | "work" | "attendance" | "progress" | "readings" | "recordings" | "announcements" | "practice" | "roster" | "review" | "report";

const LEARNER_TABS: readonly TabKey[] = ["overview", "lessons", "work", "attendance", "progress", "readings", "recordings", "announcements", "practice"];
const STAFF_TABS: readonly TabKey[] = ["overview", "lessons", "work", "roster", "review", "progress", "practice", "readings", "recordings", "announcements", "report"];

export default function ClassGroupPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ClassGroupWorkspace />
    </Suspense>
  );
}

// One class group for its active learners, assigned teachers and administrators.
function ClassGroupWorkspace() {
  const { classGroupId } = useParams<{ classGroupId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { t } = useWorkspace();
  const { role } = useAuth();
  const { state, reload } = useApi<ClassGroupDetail>(api.classGroup(classGroupId));

  // Which tabs to offer is presentation only; every tab's data is authorised by the server.
  const staff = role === "teacher" || role === "admin";
  const keys = staff ? STAFF_TABS : LEARNER_TABS;
  const requested = search.get("tab") as TabKey | null;
  const current: TabKey = requested && keys.includes(requested) ? requested : "overview";
  const tabs: TabItem<TabKey>[] = keys.map((key) => ({ key, label: t.classGroup.tabs[key] }));
  const back = role === "admin" ? pages.manage : staff ? pages.teach : pages.learn;

  return (
    <ApiView state={state} onRetry={reload}>
      {(detail) => (
        <>
          <PageHeader
            back={{ href: back, label: t.common.back }}
            title={detail.classGroup.name}
            intro={
              <span className="flex flex-wrap items-center gap-2">
                {detail.course && <span>{detail.course.title}</span>}
                <Badge>{t.classGroup.status[detail.classGroup.status as keyof typeof t.classGroup.status] ?? detail.classGroup.status}</Badge>
              </span>
            }
          />
          <Tabs tabs={tabs} current={current} label={detail.classGroup.name} onChange={(key) => router.replace(pages.classGroup(classGroupId, key === "overview" ? undefined : key), { scroll: false })} />
          <TabPanel tabKey={current}>
            {current === "overview" && <OverviewTab detail={detail} />}
            {current === "lessons" && <LessonSheetsTab classGroupId={classGroupId} administrator={role === "admin"} />}
            {current === "work" && <AssignmentsTab classGroupId={classGroupId} />}
            {current === "attendance" && <MyAttendanceTab classGroupId={classGroupId} />}
            {current === "progress" && <ProgressTab classGroupId={classGroupId} staff={staff} />}
            {current === "readings" && <ReadingsTab classGroupId={classGroupId} />}
            {current === "recordings" && <RecordingsTab classGroupId={classGroupId} />}
            {current === "announcements" && <AnnouncementFeed url={api.classAnnouncements(classGroupId)} postTo={classGroupId} />}
            {current === "practice" && <PracticeTab classGroupId={classGroupId} staff={staff} />}
            {current === "roster" && <RosterTab classGroupId={classGroupId} />}
            {current === "review" && <ReviewTab classGroupId={classGroupId} />}
            {current === "report" && <ReportTab classGroupId={classGroupId} />}
          </TabPanel>
        </>
      )}
    </ApiView>
  );
}
