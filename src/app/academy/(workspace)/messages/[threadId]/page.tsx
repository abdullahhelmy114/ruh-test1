"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { displayName } from "@/lib/academy/workspace/format";
import { requestJson, useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api, pages } from "@/components/academy/workspace/paths";
import type { Thread } from "@/components/academy/workspace/types";
import { ApiView, Button, FailureNotice, Field, PageHeader, TextArea } from "@/components/academy/workspace/ui";

type Message = Thread["messages"][number];

// One conversation. The server re-checks on every message that the two
// people may still talk (an ended relationship stops new messages).
export default function ThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const { t, fmt } = useWorkspace();
  const { state, reload } = useApi<Thread>(api.thread(threadId));

  useEffect(() => {
    if (state.status === "ready") void requestJson(api.thread(threadId), { method: "PATCH", body: { action: "mark_read" } });
  }, [state.status, threadId]);

  return (
    <ApiView state={state} onRetry={reload}>
      {(thread) => (
        <>
          <PageHeader back={{ href: pages.messages, label: t.messages.title }} title={fmt(t.messages.with, { name: displayName(thread.otherParticipant.displayName, t.common.unnamed) })} intro={t.messages.privacy} />
          <Conversation key={thread.thread.id} thread={thread} onSent={reload} />
        </>
      )}
    </ApiView>
  );
}

function Conversation({ thread, onSent }: { readonly thread: Thread; readonly onSent: () => void }) {
  const { t, dateTime } = useWorkspace();
  const { user } = useAuth();
  const [older, setOlder] = useState<Message[]>([]);
  const [exhausted, setExhausted] = useState(thread.messages.length < 50);
  const [body, setBody] = useState("");
  const action = useAction();
  const loader = useAction();
  const endRef = useRef<HTMLDivElement>(null);

  // Newest first from the server; shown oldest first.
  const messages = [...thread.messages, ...older].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread.messages.length]);

  async function loadOlder() {
    const oldest = messages[0];
    if (!oldest) return;
    const result = await requestJson<Thread>(api.thread(thread.thread.id, oldest.createdAt));
    if (result.ok) {
      setOlder((o) => [...o, ...result.data.messages]);
      if (result.data.messages.length < 50) setExhausted(true);
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(api.thread(thread.thread.id), "POST", { body });
    if (result.ok) {
      setBody("");
      onSent();
    }
  }

  return (
    <div className="space-y-4">
      {!exhausted && (
        <Button type="button" variant="outline" size="sm" busy={loader.busy} onClick={() => void loadOlder()}>
          {t.messages.older}
        </Button>
      )}
      <ol className="space-y-3" aria-live="polite">
        {messages.map((message) => {
          const mine = message.senderUid === user?.uid;
          return (
            <li key={message.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div className={mine ? "max-w-[85%] rounded-md bg-primary px-3 py-2 text-primary-foreground" : "max-w-[85%] rounded-md bg-muted px-3 py-2"}>
                <p className="whitespace-pre-line break-words" dir="auto">
                  {message.body}
                </p>
                <p className="mt-1 text-xs opacity-80">
                  {mine ? t.common.you : displayName(thread.otherParticipant.displayName, t.common.unnamed)} · <time dateTime={message.createdAt}>{dateTime(message.createdAt)}</time>
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={endRef} />
      <form onSubmit={send} className="space-y-2 border-t pt-4">
        <Field label={t.messages.placeholder} htmlFor="message-body">
          <TextArea id="message-body" dir="auto" required maxLength={4000} rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {action.failure && <FailureNotice failure={action.failure} />}
        <Button type="submit" busy={action.busy}>
          {t.messages.send}
        </Button>
      </form>
    </div>
  );
}
