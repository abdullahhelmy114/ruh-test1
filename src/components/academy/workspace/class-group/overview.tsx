"use client";

import { useAuth } from "@/lib/firebase/AuthProvider";
import { displayName } from "@/lib/academy/workspace/format";
import { useWorkspace } from "../context";
import { useOpenConversation } from "../messaging";
import { SessionList } from "../sessions";
import type { ClassGroupDetail } from "../types";
import { StatusBadge } from "../dashboard";
import { Button, EmptyState, FailureNotice, LinkButton, Section } from "../ui";
import { pages } from "../paths";

/*
 * The class overview answers "when is my next session?" first, then the
 * remaining schedule, then the course outline; the teachers demote to a
 * compact footer row. Pure reordering of live data — nothing new is fetched.
 */
export function OverviewTab({ detail }: { readonly detail: ClassGroupDetail }) {
  const { t, fmt, sessionTime } = useWorkspace();
  const { role } = useAuth();
  const conversation = useOpenConversation();
  const upcoming = detail.sessions.filter((s) => s.state === "scheduled" || s.state === "live");
  const past = detail.sessions.filter((s) => s.state === "completed" || s.state === "cancelled");
  const [featured, ...queue] = upcoming;

  return (
    <>
      <Section title={t.classGroup.schedule}>
        {!featured ? (
          <EmptyState>{t.classGroup.noSessions}</EmptyState>
        ) : (
          <div className="rounded-2xl border border-s-4 border-s-gold bg-card p-4">
            <p className="text-sm text-muted-foreground">
              <time dateTime={featured.startsAt}>{sessionTime(featured.startsAt)}</time>
            </p>
            <p className="mt-0.5 break-words font-serif text-lg">{featured.lessonTitle}</p>
            <p className="mt-1">
              <StatusBadge map={t.classGroup.sessionState} value={featured.state} tone={featured.state === "live" ? "strong" : "neutral"} />
            </p>
            <p className="mt-3 flex flex-wrap gap-2">
              {featured.meetingUrl && (
                <LinkButton href={featured.meetingUrl} variant="primary" external>
                  {t.learn.join}
                </LinkButton>
              )}
              <LinkButton href={pages.session(featured.id)}>{t.classGroup.openSession}</LinkButton>
            </p>
          </div>
        )}
        {queue.length > 0 && (
          <div className="mt-4">
            <SessionList sessions={queue} classGroupId={detail.classGroup.id} empty={t.classGroup.noSessions} />
          </div>
        )}
        {past.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">
              {t.classGroup.sessionState.completed} ({past.length})
            </summary>
            <div className="mt-3">
              <SessionList sessions={past} classGroupId={detail.classGroup.id} empty={t.classGroup.noSessions} />
            </div>
          </details>
        )}
      </Section>

      <Section title={t.classGroup.outline}>
        {detail.outline.length === 0 ? (
          <EmptyState>{t.classGroup.noOutline}</EmptyState>
        ) : (
          <ol className="space-y-3">
            {detail.outline.map((unit, index) => (
              <li key={unit.unitId} className="rounded-xl border bg-card p-4">
                <h3 className="font-serif text-lg">
                  {fmt("{n}", { n: index + 1 })}. {unit.title}
                </h3>
                <ol className="mt-2 list-decimal space-y-1 ps-6 text-sm">
                  {unit.lessons.map((lesson) => (
                    <li key={lesson.lessonId}>
                      {lesson.title}
                      {lesson.plannedMinutes !== null && (
                        <span className="ms-2 text-muted-foreground">({fmt(t.common.minutes, { count: lesson.plannedMinutes })})</span>
                      )}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title={t.classGroup.teachers}>
        {conversation.failure && <FailureNotice failure={conversation.failure} />}
        {detail.teachers.length === 0 ? (
          <EmptyState>{t.classGroup.noTeachers}</EmptyState>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {detail.teachers.map((teacher) => (
              <li key={teacher.uid} className="flex items-center gap-3 rounded-full border bg-card px-4 py-1.5">
                <span className="text-sm">{displayName(teacher.displayName, t.common.unnamed)}</span>
                {role === "student" && (
                  <Button type="button" size="sm" variant="ghost" busy={conversation.busy} onClick={() => conversation.open(teacher.uid, detail.classGroup.id)}>
                    {t.classGroup.message}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
