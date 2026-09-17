"use client";

import { useParams } from "next/navigation";
import { AnnouncementFeed } from "@/components/academy/workspace/announcements";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api, pages } from "@/components/academy/workspace/paths";
import { PageHeader } from "@/components/academy/workspace/ui";

// Target of class-group announcement notifications.
export default function ClassGroupAnnouncementsPage() {
  const { classGroupId } = useParams<{ classGroupId: string }>();
  const { t } = useWorkspace();
  return (
    <>
      <PageHeader back={{ href: pages.classGroup(classGroupId), label: t.lesson.back }} title={t.announcements.title} />
      <AnnouncementFeed url={api.classAnnouncements(classGroupId)} postTo={classGroupId} />
    </>
  );
}
