"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAction, useApi } from "./api";
import { useWorkspace } from "./context";
import { api } from "./paths";
import type { Announcements } from "./types";
import { ApiView, Badge, Button, Card, EmptyState, FailureNotice, Field, Notice, ReasonField, Section, TextArea, TextInput } from "./ui";

/** Announcements feed; when `postTo` is set, staff can post to that class group. */
export function AnnouncementFeed({ url, postTo }: { readonly url: string; readonly postTo?: string }) {
  const { t } = useWorkspace();
  const { role } = useAuth();
  const { state, reload } = useApi<Announcements>(url);
  const staff = role === "teacher" || role === "admin";
  return (
    <>
      {postTo && staff && <PostAnnouncement classGroupId={postTo} onPosted={reload} />}
      <ApiView state={state} onRetry={reload}>
        {(items) =>
          items.length === 0 ? (
            <EmptyState>{t.classGroup.announcementsEmpty}</EmptyState>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.id}>
                  <AnnouncementCard item={item} onChanged={reload} />
                </li>
              ))}
            </ul>
          )
        }
      </ApiView>
    </>
  );
}

function AnnouncementCard({ item, onChanged }: { readonly item: Announcements[number]; readonly onChanged: () => void }) {
  const { t, dateTime } = useWorkspace();
  const { user, role } = useAuth();
  const [withdrawing, setWithdrawing] = useState(false);
  const [reason, setReason] = useState("");
  const action = useAction();
  // The server decides; the control is offered to the author and administrators only.
  const mayWithdraw = role === "admin" || (user !== null && user.uid === item.authorUid);

  async function withdraw(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(api.announcement(item.id), "PATCH", { action: "withdraw", reason, expectedRevision: item.revision });
    if (result.ok) onChanged();
  }

  return (
    <Card>
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge>{t.classGroup.scope[item.scope]}</Badge>
        <time dateTime={item.publishedAt}>{dateTime(item.publishedAt)}</time>
      </p>
      <h3 className="mt-1 font-semibold">{item.title}</h3>
      <p className="mt-2 whitespace-pre-line break-words">{item.body}</p>
      {mayWithdraw && (
        <div className="mt-3">
          {!withdrawing ? (
            <Button type="button" size="sm" variant="danger" onClick={() => setWithdrawing(true)}>
              {t.classGroup.withdraw}
            </Button>
          ) : (
            <form onSubmit={withdraw} className="space-y-2">
              <ReasonField id={`withdraw-${item.id}`} value={reason} onChange={setReason} />
              {action.failure && <FailureNotice failure={action.failure} />}
              <div className="flex gap-2">
                <Button type="submit" size="sm" variant="danger" busy={action.busy}>
                  {t.classGroup.withdraw}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setWithdrawing(false)}>
                  {t.common.cancel}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}

function PostAnnouncement({ classGroupId, onPosted }: { readonly classGroupId: string; readonly onPosted: () => void }) {
  const { t } = useWorkspace();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [posted, setPosted] = useState(false);
  const action = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPosted(false);
    const result = await action.run(api.classAnnouncements(classGroupId), "POST", { title, body });
    if (result.ok) {
      setTitle("");
      setBody("");
      setPosted(true);
      onPosted();
    }
  }

  return (
    <Section title={t.classGroup.post}>
      <form onSubmit={submit} className="space-y-3 rounded-md border p-4">
        <Field label={t.classGroup.announcementTitle} htmlFor="announcement-title">
          <TextInput id="announcement-title" value={title} required maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={t.classGroup.announcementBody} htmlFor="announcement-body">
          <TextArea id="announcement-body" value={body} required maxLength={20000} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {action.failure && <FailureNotice failure={action.failure} />}
        {posted && <Notice tone="success">{t.common.saved}</Notice>}
        <Button type="submit" busy={action.busy}>
          {t.classGroup.postButton}
        </Button>
      </form>
    </Section>
  );
}
