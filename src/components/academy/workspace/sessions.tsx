"use client";

import { useWorkspace } from "./context";
import { pages } from "./paths";
import { Badge, EmptyState, LinkButton, TextLink } from "./ui";

export interface SessionRow {
  readonly id: string;
  readonly classGroupId?: string;
  readonly lessonId: string;
  readonly lessonTitle: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly state: string;
  readonly meetingUrl: string | null;
  readonly preparationStatus?: string;
}

/** Sessions with their time, lesson, meeting link (when the server sent one) and links onward. */
export function SessionList({
  sessions,
  classGroupNames,
  empty,
  classGroupId,
}: {
  readonly sessions: readonly SessionRow[];
  readonly classGroupNames?: ReadonlyMap<string, string>;
  readonly empty: string;
  /** When every session belongs to one class group. */
  readonly classGroupId?: string;
}) {
  const { t, fmt, sessionTime } = useWorkspace();
  if (sessions.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <ul className="space-y-3">
      {sessions.map((session) => {
        const groupId = session.classGroupId ?? classGroupId ?? "";
        const state = t.classGroup.sessionState[session.state as keyof typeof t.classGroup.sessionState] ?? session.state;
        return (
          <li key={session.id} className="rounded-xl border bg-card p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  <time dateTime={session.startsAt}>{sessionTime(session.startsAt)}</time>
                  {classGroupNames && groupId && classGroupNames.get(groupId) ? <> {"· "}<bdi>{classGroupNames.get(groupId)}</bdi></> : null}
                </p>
                <p className="font-medium">{session.lessonTitle}</p>
                <p className="mt-1 flex flex-wrap gap-2">
                  <Badge tone={session.state === "live" ? "strong" : "neutral"}>{state}</Badge>
                  {session.preparationStatus && (
                    <Badge tone={session.preparationStatus === "ready" ? "strong" : "warning"}>
                      {fmt(t.session.prepOf, { state: t.session.prepStatus[session.preparationStatus as keyof typeof t.session.prepStatus] ?? session.preparationStatus })}
                    </Badge>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {session.meetingUrl && (
                  <LinkButton href={session.meetingUrl} variant="primary" external>
                    {t.learn.join}
                  </LinkButton>
                )}
                <LinkButton href={pages.session(session.id)}>{t.classGroup.openSession}</LinkButton>
                {groupId && <TextLink href={pages.lessonSheet(groupId, session.lessonId)}>{t.session.lessonSheet}</TextLink>}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
