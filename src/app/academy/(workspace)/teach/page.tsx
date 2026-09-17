"use client";

import { useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api, pages } from "@/components/academy/workspace/paths";
import { SessionList } from "@/components/academy/workspace/sessions";
import type { MyTeaching, ReviewQueue } from "@/components/academy/workspace/types";
import { ApiView, Badge, Card, EmptyState, LinkButton, PageHeader, Section, TextLink } from "@/components/academy/workspace/ui";

// Teacher home: assigned class groups, upcoming sessions with preparation
// status, and work waiting for review.
export default function TeachPage() {
  const { t, fmt } = useWorkspace();
  const { state, reload } = useApi<MyTeaching>(api.myTeaching);

  return (
    <>
      <PageHeader title={t.teach.title} intro={t.teach.intro} />
      <ApiView state={state} onRetry={reload}>
        {(data) => {
          const names = new Map(data.classGroups.map((entry) => [entry.classGroup.id, entry.classGroup.name]));
          const running = data.classGroups.filter((entry) => entry.classGroup.status !== "cancelled");
          return (
            <>
              <Section title={t.teach.upcoming}>
                <SessionList sessions={data.upcomingSessions} classGroupNames={names} empty={t.teach.noUpcoming} />
              </Section>

              <Section title={t.teach.review}>
                {running.length === 0 ? (
                  <EmptyState>{t.teach.noReview}</EmptyState>
                ) : (
                  <div className="space-y-3">
                    {running.map((entry) => (
                      <ReviewCount key={entry.classGroup.id} classGroupId={entry.classGroup.id} name={entry.classGroup.name} />
                    ))}
                  </div>
                )}
              </Section>

              <Section title={t.teach.classes}>
                {data.classGroups.length === 0 ? (
                  <EmptyState>{t.teach.noClasses}</EmptyState>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {data.classGroups.map((entry) => (
                      <li key={entry.classGroup.id}>
                        <Card>
                          <p className="text-sm text-muted-foreground">{entry.course.title}</p>
                          <h3 className="font-semibold">{entry.classGroup.name}</h3>
                          <p className="mt-2 flex flex-wrap gap-2">
                            <Badge>{t.classGroup.status[entry.classGroup.status as keyof typeof t.classGroup.status] ?? entry.classGroup.status}</Badge>
                            <Badge>{fmt(t.teach.activeLearners, { count: entry.activeLearners })}</Badge>
                          </p>
                          <p className="mt-3">
                            <LinkButton href={pages.classGroup(entry.classGroup.id)}>{t.learn.openClass}</LinkButton>
                          </p>
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

function ReviewCount({ classGroupId, name }: { readonly classGroupId: string; readonly name: string }) {
  const { t, fmt } = useWorkspace();
  const { state } = useApi<ReviewQueue>(api.reviewQueue(classGroupId));
  if (state.status !== "ready") return null;
  const waiting = state.data.filter((entry) => entry.state === "needs_review" || entry.awaitingRelease).length;
  if (waiting === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-2">
      <TextLink href={pages.classGroup(classGroupId, "review")}>{name}</TextLink>
      <Badge tone="warning">{fmt(t.classGroup.attemptsSummary, { count: waiting })}</Badge>
    </p>
  );
}
