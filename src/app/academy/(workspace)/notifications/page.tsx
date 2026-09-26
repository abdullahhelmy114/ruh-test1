"use client";

import Link from "next/link";
import { useState } from "react";
import { useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api } from "@/components/academy/workspace/paths";
import type { Notifications } from "@/components/academy/workspace/types";
import { ApiView, Button, EmptyState, FailureNotice, Loading, PageHeader } from "@/components/academy/workspace/ui";
import { cn } from "@/lib/utils";

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
            <Button type="button" variant={unreadOnly ? "primary" : "outline"} size="sm" aria-pressed={unreadOnly} onClick={() => setUnreadOnly((v) => !v)}>
              {t.notifications.unreadOnly}
            </Button>
            <Button type="button" variant="outline" size="sm" busy={action.busy} onClick={() => void markAll()}>
              {t.notifications.markAll}
            </Button>
          </>
        }
      />
      {action.failure && <FailureNotice failure={action.failure} onRetry={reload} />}
      <ApiView state={state} onRetry={reload} loading={<Loading shape="list" />}>
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState>{t.notifications.empty}</EmptyState>
          ) : (
            <ul className="divide-y rounded-2xl border">
              {data.items.map((item) => {
                const unread = !item.readAt;
                return (
                  <li
                    key={item.id}
                    className={cn(
                      "flex flex-col gap-2 p-3 first:rounded-t-2xl last:rounded-b-2xl sm:flex-row sm:items-center sm:justify-between",
                      unread && "bg-primary/5",
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span aria-hidden="true" className={cn("mt-2 size-2 shrink-0 rounded-full", unread ? "bg-primary" : "bg-transparent")} />
                      <div className="min-w-0">
                        <p className={unread ? "font-semibold" : ""}>
                          {unread && <span className="sr-only">{t.notifications.unreadItem}: </span>}
                          {item.link ? (
                            <Link href={item.link} className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              {item.title}
                            </Link>
                          ) : (
                            item.title
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time>
                        </p>
                      </div>
                    </div>
                    {unread && (
                      <div className="shrink-0 ps-5 sm:ps-0">
                        <Button type="button" size="sm" variant="ghost" onClick={() => void markOne(item.id)}>
                          {t.notifications.markRead}
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )
        }
      </ApiView>
    </>
  );
}
