"use client";

import { useState } from "react";
import { useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api } from "@/components/academy/workspace/paths";
import type { Notifications } from "@/components/academy/workspace/types";
import { ApiView, Badge, Button, EmptyState, FailureNotice, LinkButton, PageHeader } from "@/components/academy/workspace/ui";

// The caller's notifications. They name what happened; details stay behind
// the normal access checks of the page they link to.
export default function NotificationsPage() {
  const { t, dateTime } = useWorkspace();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { state, reload } = useApi<Notifications>(api.notifications(unreadOnly));
  const action = useAction();

  async function markAll() {
    const result = await action.run(api.notifications(false), "PATCH", { action: "mark_all_read" });
    if (result.ok) reload();
  }

  async function markOne(id: string) {
    const result = await action.run(api.notification(id), "PATCH", { action: "mark_read" });
    if (result.ok) reload();
  }

  return (
    <>
      <PageHeader
        title={t.notifications.title}
        actions={
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
              {t.notifications.unreadOnly}
            </label>
            <Button type="button" variant="outline" size="sm" busy={action.busy} onClick={() => void markAll()}>
              {t.notifications.markAll}
            </Button>
          </>
        }
      />
      {action.failure && <FailureNotice failure={action.failure} onRetry={reload} />}
      <ApiView state={state} onRetry={reload}>
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState>{t.notifications.empty}</EmptyState>
          ) : (
            <ul className="divide-y rounded-md border">
              {data.items.map((item) => (
                <li key={item.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className={item.readAt ? "" : "font-semibold"}>
                      {!item.readAt && <span className="sr-only">{t.nav.unread.replace("{count}", "1")}: </span>}
                      {item.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!item.readAt && <Badge tone="strong">•</Badge>}
                    {item.link && <LinkButton href={item.link}>{t.notifications.open}</LinkButton>}
                    {!item.readAt && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => void markOne(item.id)}>
                        {t.notifications.markRead}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </ApiView>
    </>
  );
}
