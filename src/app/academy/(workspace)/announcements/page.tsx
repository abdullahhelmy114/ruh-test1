"use client";

import { AnnouncementFeed } from "@/components/academy/workspace/announcements";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api } from "@/components/academy/workspace/paths";
import { PageHeader } from "@/components/academy/workspace/ui";

// Academy-wide announcements for every signed-in member.
export default function AnnouncementsPage() {
  const { t } = useWorkspace();
  return (
    <>
      <PageHeader title={t.announcements.title} />
      <AnnouncementFeed url={api.announcements} />
    </>
  );
}
