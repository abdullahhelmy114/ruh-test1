"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { displayName } from "@/lib/academy/workspace/format";
import { useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { useOpenConversation } from "@/components/academy/workspace/messaging";
import { api, pages } from "@/components/academy/workspace/paths";
import type { ClassGroupDetail, MyLearning, MyTeaching, Roster, Threads } from "@/components/academy/workspace/types";
import { ApiView, Badge, Button, EmptyState, FailureNotice, Field, Notice, PageHeader, Section, SelectInput, TextLink } from "@/components/academy/workspace/ui";

// The caller's conversations and starting a new one with someone they may message.
export default function MessagesPage() {
  const { t } = useWorkspace();
  const { state, reload } = useApi<Threads>(api.threads);
  return (
    <>
      <PageHeader title={t.messages.title} intro={t.messages.privacy} />
      <NewConversation />
      <Section title={t.messages.title}>
        <ApiView state={state} onRetry={reload}>
          {(threads) => (threads.length === 0 ? <EmptyState>{t.messages.empty}</EmptyState> : <ThreadList threads={threads} />)}
        </ApiView>
      </Section>
    </>
  );
}

function ThreadList({ threads }: { readonly threads: Threads }) {
  const { t, fmt, dateTime } = useWorkspace();
  return (
    <ul className="divide-y rounded-md border">
      {threads.map((thread) => (
        <li key={thread.id} className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TextLink href={pages.thread(thread.id)}>{displayName(thread.otherParticipant.displayName, t.common.unnamed)}</TextLink>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              {thread.classGroupName && <span>{thread.classGroupName}</span>}
              {thread.lastMessageAt && <time dateTime={thread.lastMessageAt}>{dateTime(thread.lastMessageAt)}</time>}
              {thread.unread > 0 && <Badge tone="strong">{fmt(t.messages.unread, { count: thread.unread })}</Badge>}
            </span>
          </div>
          {thread.lastMessagePreview && <p className="mt-1 truncate text-sm text-muted-foreground" dir="auto">{thread.lastMessagePreview}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Picks a class group, then a person in it the caller may message: learners pick teachers, teachers pick learners. */
function NewConversation() {
  const { t } = useWorkspace();
  const { role } = useAuth();
  const learning = useApi<MyLearning>(role === "student" ? api.myLearning : null);
  const teaching = useApi<MyTeaching>(role === "teacher" ? api.myTeaching : null);
  const [classGroupId, setClassGroupId] = useState("");
  const [recipientUid, setRecipientUid] = useState("");
  const conversation = useOpenConversation();

  if (role !== "student" && role !== "teacher") return null;
  const groups =
    role === "student"
      ? learning.state.status === "ready"
        ? learning.state.data.classGroups.filter((g) => g.enrollmentState === "active").map((g) => ({ id: g.classGroup.id, name: g.classGroup.name }))
        : []
      : teaching.state.status === "ready"
        ? teaching.state.data.classGroups.filter((g) => g.classGroup.status === "planned" || g.classGroup.status === "active").map((g) => ({ id: g.classGroup.id, name: g.classGroup.name }))
        : [];
  if (groups.length === 0) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (classGroupId && recipientUid) void conversation.open(recipientUid, classGroupId);
  }

  return (
    <Section title={t.messages.start}>
      <form onSubmit={submit} className="grid gap-3 rounded-md border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label={t.messages.chooseClass} htmlFor="conversation-class">
          <SelectInput
            id="conversation-class"
            required
            value={classGroupId}
            onChange={(e) => {
              setClassGroupId(e.target.value);
              setRecipientUid("");
            }}
          >
            <option value="">{t.common.choose}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        {classGroupId ? <RecipientPicker classGroupId={classGroupId} role={role} value={recipientUid} onChange={setRecipientUid} /> : <div />}
        <Button type="submit" busy={conversation.busy} disabled={!recipientUid}>
          {t.messages.startButton}
        </Button>
        {conversation.failure && (
          <div className="sm:col-span-3">
            <FailureNotice failure={conversation.failure} />
          </div>
        )}
      </form>
    </Section>
  );
}

function RecipientPicker({ classGroupId, role, value, onChange }: { readonly classGroupId: string; readonly role: "student" | "teacher"; readonly value: string; readonly onChange: (uid: string) => void }) {
  const { t } = useWorkspace();
  const detail = useApi<ClassGroupDetail>(role === "student" ? api.classGroup(classGroupId) : null);
  const roster = useApi<Roster>(role === "teacher" ? api.roster(classGroupId) : null);
  const people =
    role === "student"
      ? detail.state.status === "ready"
        ? detail.state.data.teachers.map((p) => ({ uid: p.uid, name: p.displayName }))
        : []
      : roster.state.status === "ready"
        ? roster.state.data.filter((r) => r.enrollmentState === "active").map((r) => ({ uid: r.learnerUid, name: r.displayName }))
        : [];
  const loaded = role === "student" ? detail.state.status !== "loading" : roster.state.status !== "loading";
  if (loaded && people.length === 0) return <Notice>{t.messages.noRecipients}</Notice>;
  return (
    <Field label={t.messages.chooseRecipient} htmlFor="conversation-recipient">
      <SelectInput id="conversation-recipient" required value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t.common.choose}</option>
        {people.map((person) => (
          <option key={person.uid} value={person.uid}>
            {displayName(person.name, t.common.unnamed)}
          </option>
        ))}
      </SelectInput>
    </Field>
  );
}
