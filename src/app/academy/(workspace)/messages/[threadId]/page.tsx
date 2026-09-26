"use client";

import { useParams } from "next/navigation";
import { Fragment, memo, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { INTL_LOCALE, displayName } from "@/lib/academy/workspace/format";
import { requestJson, useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api, pages } from "@/components/academy/workspace/paths";
import type { Thread } from "@/components/academy/workspace/types";
import { ApiView, Button, EmptyState, FailureNotice, Loading, PageHeader, TextArea } from "@/components/academy/workspace/ui";
import { cn } from "@/lib/utils";

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
    <ApiView state={state} onRetry={reload} loading={<Loading shape="list" />}>
      {(thread) => (
        <>
          <PageHeader back={{ href: pages.messages, label: t.messages.title }} title={fmt(t.messages.with, { name: displayName(thread.otherParticipant.displayName, t.common.unnamed) })} intro={t.messages.privacy} />
          <Conversation key={thread.thread.id} thread={thread} onSent={reload} />
        </>
      )}
    </ApiView>
  );
}

/** One bubble. Alignment says who spoke; the stamp is time-only. */
const MessageItem = memo(function MessageItem({
  message,
  mine,
  time,
}: {
  readonly message: { readonly id: string; readonly body: string; readonly createdAt: string };
  readonly mine: boolean;
  readonly time: string;
}) {
  return (
    <li className={mine ? "flex justify-end" : "flex justify-start"}>
      <div className={cn("max-w-[85%] rounded-2xl px-3 py-2", mine ? "rounded-ee-md bg-primary text-primary-foreground" : "rounded-es-md bg-muted")}>
        <p className="whitespace-pre-line break-words" dir="auto">
          {message.body}
        </p>
        <p className={cn("mt-1 text-xs", mine ? "text-primary-foreground/90" : "text-muted-foreground")}>
          <time dateTime={message.createdAt}>{time}</time>
        </p>
      </div>
    </li>
  );
});

function Conversation({ thread, onSent }: { readonly thread: Thread; readonly onSent: () => void }) {
  const { t, locale, timeZone, date } = useWorkspace();
  const { user } = useAuth();
  const [older, setOlder] = useState<Message[]>([]);
  const [echoes, setEchoes] = useState<readonly { readonly id: string; readonly body: string; readonly createdAt: string }[]>([]);
  const [exhausted, setExhausted] = useState(thread.messages.length < 50);
  const loader = useAction();
  const endRef = useRef<HTMLDivElement>(null);

  // Newest first from the server; shown oldest first. Local echoes are the
  // caller's just-sent words (mine by construction, no identity attached),
  // dropped once the reload brings the server's copy back.
  const messages = useMemo(() => {
    const server = [...thread.messages, ...older].map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt, mine: m.senderUid === user?.uid }));
    const extra = echoes
      .filter((echo) => !server.some((m) => m.mine && m.body === echo.body && Math.abs(Date.parse(m.createdAt) - Date.parse(echo.createdAt)) < 60_000))
      .map((echo) => ({ ...echo, mine: true }));
    return [...server, ...extra].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }, [thread.messages, older, echoes, user?.uid]);

  const timeFormat = useMemo(
    () => (timeZone ? new Intl.DateTimeFormat(INTL_LOCALE[locale], { hour: "numeric", minute: "2-digit", timeZone }) : null),
    [locale, timeZone],
  );
  const dayOf = (iso: string) => date(iso);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function loadOlder() {
    const oldest = messages[0];
    if (!oldest) return;
    const result = await requestJson<Thread>(api.thread(thread.thread.id, oldest.createdAt));
    if (result.ok) {
      setOlder((o) => [...o, ...result.data.messages]);
      if (result.data.messages.length < 50) setExhausted(true);
    }
  }

  return (
    <div className="space-y-4">
      {!exhausted && (
        <Button type="button" variant="outline" size="sm" busy={loader.busy} onClick={() => void loadOlder()}>
          {t.messages.older}
        </Button>
      )}
      {messages.length === 0 ? (
        <EmptyState>{t.messages.emptyThread}</EmptyState>
      ) : (
        <ol className="space-y-2" aria-live="polite">
          {messages.map((message, index) => {
            const day = dayOf(message.createdAt);
            const previousDay = index > 0 ? dayOf(messages[index - 1].createdAt) : null;
            const stamp = timeFormat && !Number.isNaN(Date.parse(message.createdAt)) ? timeFormat.format(new Date(message.createdAt)) : "";
            return (
              <Fragment key={message.id}>
                {day !== previousDay && day !== "" && (
                  <li className="my-4 text-center text-xs text-muted-foreground">
                    <time dateTime={message.createdAt}>{day}</time>
                  </li>
                )}
                <MessageItem message={message} mine={message.mine} time={stamp} />
              </Fragment>
            );
          })}
        </ol>
      )}
      <div ref={endRef} />
      <Composer
        threadId={thread.thread.id}
        onEcho={(message) => setEchoes((e) => [...e, message])}
        onSent={onSent}
      />
    </div>
  );
}

/** Owns the draft so typing re-renders the form alone. Enter sends; Shift+Enter breaks the line. */
function Composer({
  threadId,
  onEcho,
  onSent,
}: {
  readonly threadId: string;
  readonly onEcho: (message: { readonly id: string; readonly body: string; readonly createdAt: string }) => void;
  readonly onSent: () => void;
}) {
  const { t } = useWorkspace();
  const [body, setBody] = useState("");
  const action = useAction();

  async function send() {
    const text = body.trim();
    if (text === "" || action.busy) return;
    const result = await action.run(api.thread(threadId), "POST", { body: text });
    if (result.ok) {
      // The sender's words never vanish between send and reload.
      onEcho({ id: `local-${Date.now()}`, body: text, createdAt: new Date().toISOString() });
      setBody("");
      onSent();
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <form onSubmit={submit} className="sticky bottom-0 border-t bg-background pb-[env(safe-area-inset-bottom)] pt-3">
      {action.failure && (
        <div className="mb-2">
          <FailureNotice failure={action.failure} />
        </div>
      )}
      <div className="flex items-end gap-2">
        <TextArea
          id="message-body"
          dir="auto"
          required
          maxLength={4000}
          rows={1}
          className="max-h-40 min-h-11 field-sizing-content"
          placeholder={t.messages.placeholder}
          aria-label={t.messages.placeholder}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <Button type="submit" busy={action.busy}>
          {t.messages.send}
        </Button>
      </div>
    </form>
  );
}
