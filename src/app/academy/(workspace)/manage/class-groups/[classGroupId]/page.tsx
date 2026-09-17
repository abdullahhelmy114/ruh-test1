"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import {
  ClassGroupAssignments,
  ClassGroupDetails,
  ClassGroupEnrollments,
  ClassGroupRecordings,
  ClassGroupSessions,
  ClassGroupTeachers,
} from "@/components/academy/workspace/admin/class-group";
import { managePages, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { AdminClassGroup } from "@/components/academy/workspace/admin/types";
import { useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { ApiView, Badge, Loading, PageHeader, TabPanel, Tabs } from "@/components/academy/workspace/ui";

type TabKey = "details" | "teachers" | "sessions" | "enrollments" | "assignments" | "recordings";
const TABS: readonly TabKey[] = ["details", "teachers", "sessions", "enrollments", "assignments", "recordings"];

export default function ClassGroupAdminPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ClassGroupAdmin />
    </Suspense>
  );
}

function ClassGroupAdmin() {
  const { classGroupId } = useParams<{ classGroupId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const text = useAdminText();
  const { t } = useWorkspace();
  const { state, reload } = useApi<AdminClassGroup>(adminApi.classGroup(classGroupId));
  const requested = search.get("tab") as TabKey | null;
  const current: TabKey = requested && TABS.includes(requested) ? requested : "details";

  return (
    <ApiView state={state} onRetry={reload}>
      {(data) => (
        <>
          <PageHeader back={{ href: managePages.classGroups, label: text.classGroup.title }} title={data.classGroup.name} intro={<Badge>{t.classGroup.status[data.classGroup.status]}</Badge>} />
          <Tabs
            label={data.classGroup.name}
            tabs={TABS.map((key) => ({ key, label: text.classGroup.tabs[key] }))}
            current={current}
            onChange={(key) => router.replace(managePages.classGroup(classGroupId, key === "details" ? undefined : key), { scroll: false })}
          />
          <TabPanel tabKey={current}>
            {current === "details" && <ClassGroupDetails key={data.classGroup.revision} data={data} onChanged={reload} />}
            {current === "teachers" && <ClassGroupTeachers data={data} onChanged={reload} />}
            {current === "sessions" && <ClassGroupSessions data={data} />}
            {current === "enrollments" && <ClassGroupEnrollments data={data} />}
            {current === "assignments" && <ClassGroupAssignments data={data} />}
            {current === "recordings" && <ClassGroupRecordings data={data} />}
          </TabPanel>
        </>
      )}
    </ApiView>
  );
}
