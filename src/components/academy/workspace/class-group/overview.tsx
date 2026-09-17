"use client";

import { useAuth } from "@/lib/firebase/AuthProvider";
import { displayName } from "@/lib/academy/workspace/format";
import { useWorkspace } from "../context";
import { useOpenConversation } from "../messaging";
import { SessionList } from "../sessions";
import type { ClassGroupDetail } from "../types";
import { Button, EmptyState, FailureNotice, Section } from "../ui";

export function OverviewTab({ detail }: { readonly detail: ClassGroupDetail }) {
  const { t, fmt } = useWorkspace();
  const { role } = useAuth();
  const conversation = useOpenConversation();
  const upcoming = detail.sessions.filter((s) => s.state === "scheduled" || s.state === "live");
  const past = detail.sessions.filter((s) => s.state === "completed" || s.state === "cancelled");

  return (
    <>
      <Section title={t.classGroup.teachers}>
        {conversation.failure && <FailureNotice failure={conversation.failure} />}
        {detail.teachers.length === 0 ? (
          <EmptyState>{t.classGroup.noTeachers}</EmptyState>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {detail.teachers.map((teacher) => (
              <li key={teacher.uid} className="flex items-center gap-3 rounded-md border px-3 py-2">
                <span>{displayName(teacher.displayName, t.common.unnamed)}</span>
                {role === "student" && (
                  <Button type="button" size="sm" variant="outline" busy={conversation.busy} onClick={() => conversation.open(teacher.uid, detail.classGroup.id)}>
                    {t.classGroup.message}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t.classGroup.schedule}>
        <SessionList sessions={upcoming} classGroupId={detail.classGroup.id} empty={t.classGroup.noSessions} />
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
              <li key={unit.unitId} className="rounded-md border p-3">
                <h3 className="font-medium">
                  {index + 1}. {unit.title}
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
    </>
  );
}
