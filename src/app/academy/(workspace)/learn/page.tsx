"use client";

import { useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api, pages } from "@/components/academy/workspace/paths";
import type { AssignmentList, MyLearning } from "@/components/academy/workspace/types";
import {
  ApiView,
  Badge,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  Section,
  TextLink,
} from "@/components/academy/workspace/ui";
import { SessionList } from "@/components/academy/workspace/sessions";

// Learner home: class groups, upcoming sessions and work that is due.
export default function LearnPage() {
  const { t } = useWorkspace();
  const { state, reload } = useApi<MyLearning>(api.myLearning);

  return (
    <>
      <PageHeader title={t.learn.title} intro={t.learn.intro} />
      <ApiView state={state} onRetry={reload}>
        {(data) => {
          const names = new Map(data.classGroups.map((entry) => [entry.classGroup.id, entry.classGroup.name]));
          const active = data.classGroups.filter((entry) => entry.enrollmentState === "active");
          return (
            <>
              <Section title={t.learn.upcoming}>
                <SessionList sessions={data.upcomingSessions} classGroupNames={names} empty={t.learn.noUpcoming} />
              </Section>

              <Section title={t.learn.work}>
                {active.length === 0 ? (
                  <EmptyState>{t.learn.noWork}</EmptyState>
                ) : (
                  <div className="space-y-4">
                    {active.map((entry) => (
                      <DueWork key={entry.classGroup.id} classGroupId={entry.classGroup.id} className={entry.classGroup.name} />
                    ))}
                  </div>
                )}
              </Section>

              <Section title={t.learn.classes}>
                {data.classGroups.length === 0 ? (
                  <EmptyState>
                    {t.learn.noClasses} <TextLink href="/academy">{t.nav.catalog}</TextLink>
                  </EmptyState>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {data.classGroups.map((entry) => (
                      <li key={entry.enrollmentId}>
                        <Card>
                          <p className="text-sm text-muted-foreground">{entry.course.title}</p>
                          <h3 className="font-semibold">{entry.classGroup.name}</h3>
                          <p className="mt-2 flex flex-wrap gap-2">
                            <Badge>{t.classGroup.status[entry.classGroup.status as keyof typeof t.classGroup.status] ?? entry.classGroup.status}</Badge>
                            <Badge tone={entry.enrollmentState === "active" ? "strong" : "neutral"}>
                              {t.learn.enrollment[entry.enrollmentState as keyof typeof t.learn.enrollment] ?? entry.enrollmentState}
                            </Badge>
                          </p>
                          {entry.enrollmentState === "active" && (
                            <p className="mt-3">
                              <LinkButton href={pages.classGroup(entry.classGroup.id)}>{t.learn.openClass}</LinkButton>
                            </p>
                          )}
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </>
          );
        }}
      </ApiView>
    </>
  );
}

/** Open assignments of one class group that still need the learner's work. */
function DueWork({ classGroupId, className }: { readonly classGroupId: string; readonly className: string }) {
  const { t, sessionTime } = useWorkspace();
  const { state, reload } = useApi<AssignmentList>(api.assignments(classGroupId));
  return (
    <ApiView state={state} onRetry={reload}>
      {(list) => {
        const now = Date.now();
        const open = list.filter((entry) => {
          if (!("attempts" in entry)) return false;
          const latest = [...entry.attempts].sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
          const needsWork = !latest || latest.state === "in_progress" || latest.state === "returned";
          return needsWork && Date.parse(entry.assignment.opensAt) <= now;
        });
        if (open.length === 0) return null;
        return (
          <Card>
            <h3 className="mb-2 font-semibold">{className}</h3>
            <ul className="space-y-2">
              {open.map((entry) => (
                <li key={entry.assignment.id} className="flex flex-wrap items-center justify-between gap-2">
                  <TextLink href={pages.assignment(entry.assignment.id)}>{entry.assignment.title}</TextLink>
                  {entry.assignment.dueAt && (
                    <span className="text-sm text-muted-foreground">
                      {t.common.due}: {sessionTime(entry.assignment.dueAt)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        );
      }}
    </ApiView>
  );
}
