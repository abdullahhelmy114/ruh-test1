"use client";

import { Award, BookOpen, ClipboardList, Gift, Library, Puzzle, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { requestJson, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import {
  DashboardCard,
  ProgressBar,
  QuickAction,
  SectionHeader,
  StatusBadge,
  UpcomingSessionsCard,
  WelcomeStat,
} from "@/components/academy/workspace/dashboard";
import { api, pages } from "@/components/academy/workspace/paths";
import { useUnreadNotifications } from "@/components/academy/workspace/shell";
import type {
  Announcements,
  AssignmentList,
  MyCertificates,
  MyLearning,
  ProgressView,
  Remediation,
  Threads,
} from "@/components/academy/workspace/types";
import {
  ApiView,
  Badge,
  EmptyState,
  LinkButton,
  Notice,
  TextLink,
} from "@/components/academy/workspace/ui";
import { cn } from "@/lib/utils";

/*
 * Learner dashboard, in the owner-approved Gate 2B composition: a premium
 * welcome panel, Courses in Progress beside a clearly separate Upcoming
 * Sessions calendar, then progress and due work, then communication and
 * quick continuation, then the quiet lower row. Under the surface it keeps
 * the Gate 2C engineering: incremental per-class loading, the shared unread
 * request, cached formatters, localized digits and a geometry-matched
 * skeleton. Presentation only — every value comes from the live APIs.
 */
export default function LearnPage() {
  const { state, reload } = useApi<MyLearning>(api.myLearning);
  return (
    <ApiView state={state} onRetry={reload} loading={<PageSkeleton />}>
      {(data) => <Dashboard data={data} />}
    </ApiView>
  );
}

/** A skeleton shaped like the real zones, so first paint reserves the layout. */
function PageSkeleton() {
  const pulse = "animate-pulse rounded-2xl border bg-muted/40 motion-reduce:animate-none";
  return (
    <div aria-hidden="true" className="space-y-10">
      <div className={cn(pulse, "min-h-40 rounded-3xl")} />
      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={cn(pulse, "min-h-48")} />
          <div className={cn(pulse, "min-h-48")} />
        </div>
        <div className={cn(pulse, "min-h-52")} />
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <div className={cn(pulse, "min-h-36")} />
        <div className={cn(pulse, "min-h-36")} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className={cn(pulse, "min-h-32")} />
        <div className={cn(pulse, "min-h-32")} />
        <div className={cn(pulse, "min-h-32")} />
      </div>
    </div>
  );
}

/** One open work item, as the due-work hook reports it. */
interface OpenWork {
  readonly id: string;
  readonly title: string;
  readonly dueAt: string | null;
  readonly returned: boolean;
}

/** Loads a per-class resource incrementally: each class paints as its own request settles. */
function usePerGroup<T>(classGroupIds: readonly string[], url: (id: string) => string, select: (data: unknown) => T) {
  const { user, isLoading } = useAuth();
  const [map, setMap] = useState<ReadonlyMap<string, T>>(new Map());
  const key = classGroupIds.join("|");
  useEffect(() => {
    if (isLoading || !user || key === "") return;
    let cancelled = false;
    for (const id of key.split("|")) {
      requestJson<unknown>(url(id)).then((result) => {
        if (cancelled || !result.ok) return;
        setMap((previous) => new Map(previous).set(id, select(result.data)));
      });
    }
    return () => {
      cancelled = true;
    };
    // url/select are stable module-level helpers per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, user, isLoading]);
  return map;
}

const selectProgress = (data: unknown) => data as ProgressView;
const selectRemediation = (data: unknown) => (data as Remediation).filter((row) => row.state === "assigned").length;
const selectOpenWork = (data: unknown): readonly OpenWork[] => {
  const now = Date.now();
  return (data as AssignmentList).flatMap((entry) => {
    if (!("attempts" in entry)) return [];
    const latest = [...entry.attempts].sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
    const needsWork = !latest || latest.state === "in_progress" || latest.state === "returned";
    if (!needsWork || Date.parse(entry.assignment.opensAt) > now) return [];
    return [{ id: entry.assignment.id, title: entry.assignment.title, dueAt: entry.assignment.dueAt, returned: latest?.state === "returned" }];
  });
};

function Dashboard({ data }: { readonly data: MyLearning }) {
  const { t, fmt, number, sessionTime } = useWorkspace();
  const { user } = useAuth();
  const displayName = user?.displayName?.trim() || "";
  const active = data.classGroups.filter((entry) => entry.enrollmentState === "active");
  const activeIds = active.map((entry) => entry.classGroup.id);
  const names = new Map(data.classGroups.map((entry) => [entry.classGroup.id, entry.classGroup.name]));
  const next = data.upcomingSessions[0];
  const progressMap = usePerGroup(activeIds, api.progress, selectProgress);
  const workMap = usePerGroup(activeIds, api.assignments, selectOpenWork);
  const remediationMap = usePerGroup(activeIds, (id) => api.remediation(id), selectRemediation);

  return (
    <div className="space-y-10">
      {/* Welcome panel: greeting and real facts on the left, the next session on the right. */}
      <header>
        <div className="rounded-3xl border bg-card p-6 text-card-foreground sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_minmax(260px,340px)] lg:items-center">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] rtl:tracking-normal text-muted-foreground">
                <span aria-hidden="true" className="h-px w-4 bg-gold" />
                {t.learn.title}
              </p>
              <h1 className="mt-1.5 break-words font-serif text-3xl sm:text-4xl">
                {displayName ? fmt(t.dashboard.greetingName, { name: displayName }) : t.dashboard.greeting}
              </h1>
              <p className="mt-2 text-muted-foreground">{t.dashboard.intro}</p>
              <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
                <WelcomeStat label={t.dashboard.activeClasses} value={number(active.length)} />
              </dl>
              <p className="mt-5">
                {active.length > 0 ? (
                  <LinkButton href={pages.classGroup(active[0].classGroup.id)} variant="primary">
                    {t.learn.openClass}
                  </LinkButton>
                ) : (
                  <LinkButton href="/academy" variant="primary">
                    {t.nav.catalog}
                  </LinkButton>
                )}
              </p>
            </div>
            <div className="rounded-2xl border bg-background/60 p-4">
              <p className="text-xs uppercase tracking-wider rtl:tracking-normal text-muted-foreground">{t.dashboard.nextSession}</p>
              {next ? (
                <>
                  <p className="mt-1.5 break-words font-medium">{next.lessonTitle}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <time dateTime={next.startsAt}>{sessionTime(next.startsAt)}</time>
                    {next.classGroupId && names.get(next.classGroupId) ? (
                      <>
                        {" · "}
                        <bdi>{names.get(next.classGroupId)}</bdi>
                      </>
                    ) : null}
                  </p>
                  <p className="mt-3 flex flex-wrap gap-2">
                    {next.meetingUrl && (
                      <LinkButton href={next.meetingUrl} variant="primary" external>
                        {t.learn.join}
                      </LinkButton>
                    )}
                    <LinkButton href={pages.session(next.id)}>{t.classGroup.openSession}</LinkButton>
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-sm text-muted-foreground">{t.dashboard.noNextSession}</p>
              )}
            </div>
          </div>
        </div>
        {active.map((entry) => (
          <RemediationNudge
            key={entry.classGroup.id}
            classGroupId={entry.classGroup.id}
            name={entry.classGroup.name}
            assigned={remediationMap.get(entry.classGroup.id) ?? 0}
          />
        ))}
      </header>

      {/* Primary zone: courses in progress and the clearly separate upcoming-session calendar. */}
      <div className="grid items-start gap-8 lg:grid-cols-[3fr_2fr]">
        <section aria-label={t.dashboard.courses}>
          <SectionHeader eyebrow={t.dashboard.coursesEyebrow} title={t.dashboard.courses} />
          {data.classGroups.length === 0 ? (
            <EmptyState action={<LinkButton href="/academy" variant="primary">{t.nav.catalog}</LinkButton>}>
              {t.learn.noClasses}
            </EmptyState>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {data.classGroups.map((entry) => (
                <li key={entry.enrollmentId}>
                  <CourseCard
                    entry={entry}
                    progress={progressMap.get(entry.classGroup.id) ?? null}
                    nextSession={data.upcomingSessions.find((session) => session.classGroupId === entry.classGroup.id) ?? null}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-label={t.learn.upcoming}>
          <SectionHeader eyebrow={t.dashboard.calendarEyebrow} title={t.learn.upcoming} />
          {data.upcomingSessions.length === 0 ? (
            <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed p-6 text-center">
              <div>
                <p className="font-medium">{t.learn.noUpcoming}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t.dashboard.noUpcomingBody}</p>
              </div>
            </div>
          ) : (
            <UpcomingSessionsCard sessions={data.upcomingSessions} classGroupNames={names} empty={t.learn.noUpcoming} />
          )}
        </section>
      </div>

      {/* Secondary zone: one aggregated progress card and the work that is due. */}
      <div className="grid items-start gap-8 md:grid-cols-2">
        <section aria-label={t.dashboard.overview}>
          <SectionHeader eyebrow={t.classGroup.tabs.progress} title={t.dashboard.overview} />
          <ProgressOverview active={active} progressMap={progressMap} />
        </section>
        <section aria-label={t.learn.work}>
          <SectionHeader eyebrow={t.dashboard.workEyebrow} title={t.learn.work} />
          {active.length === 0 ? (
            <EmptyState>{t.learn.noWork}</EmptyState>
          ) : (
            <DueWorkSection active={active} workMap={workMap} />
          )}
        </section>
      </div>

      {/* Activity zone: continue-learning leads; announcements and the inbox accompany it. */}
      <div className="grid items-start gap-8 lg:grid-cols-[2fr_1fr]">
        <section aria-label={t.dashboard.continueLearning}>
          <SectionHeader eyebrow={t.dashboard.continueEyebrow} title={t.dashboard.continueLearning} />
          {active.length === 0 ? (
            <EmptyState>{t.learn.noClasses}</EmptyState>
          ) : (
            <ContinueLearning classGroupId={active[0].classGroup.id} />
          )}
        </section>
        <div className="space-y-8">
          <section aria-label={t.dashboard.announcements}>
            <SectionHeader title={t.dashboard.announcements} action={<TextLink href={pages.announcements}>{t.dashboard.viewAll}</TextLink>} />
            <LatestAnnouncements />
          </section>
          <section aria-label={t.dashboard.inbox}>
            <SectionHeader title={t.dashboard.inbox} />
            <InboxCard />
          </section>
        </div>
      </div>

      {/* Lower row: certificates, referral and the truthful placement state. */}
      <div className="grid items-start gap-8 md:grid-cols-3">
        <section aria-label={t.nav.certificates}>
          <SectionHeader title={t.nav.certificates} />
          <CertificatesCard />
        </section>
        <section aria-label={t.dashboard.referral}>
          <SectionHeader title={t.dashboard.referral} />
          <DashboardCard>
            <p className="flex items-start gap-3">
              <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Gift className="h-4 w-4" />
              </span>
              <span className="text-sm text-muted-foreground">{t.dashboard.referralBody}</span>
            </p>
            <p className="mt-3">
              <LinkButton href="/affiliate">{t.dashboard.openReferral}</LinkButton>
            </p>
          </DashboardCard>
        </section>
        <section aria-label={t.dashboard.placement}>
          <SectionHeader title={t.dashboard.placement} />
          <DashboardCard className="border-dashed bg-muted/20">
            <p className="flex items-start gap-3">
              <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                <ClipboardList className="h-4 w-4" />
              </span>
              {/* Truthful state only: not implemented, so no start action exists. */}
              <span className="text-sm text-muted-foreground">{t.dashboard.placementUnavailable}</span>
            </p>
          </DashboardCard>
        </section>
      </div>
    </div>
  );
}

/** One enrolled class: course, group, states, live progress and the next real session. */
function CourseCard({
  entry,
  progress,
  nextSession,
}: {
  readonly entry: MyLearning["classGroups"][number];
  readonly progress: ProgressView | null;
  readonly nextSession: MyLearning["upcomingSessions"][number] | null;
}) {
  const { t, fmt, percent, sessionTime } = useWorkspace();
  const activeHere = entry.enrollmentState === "active";
  const lessons = progress?.progress.lessons ?? null;
  const attendance = progress?.progress.attendance.attendedRatio ?? null;
  return (
    <DashboardCard className="flex h-full flex-col">
      <p className="text-sm text-muted-foreground">{entry.course.title}</p>
      <h3 className="mt-0.5 break-words font-serif text-lg">{entry.classGroup.name}</h3>
      <p className="mt-2 flex flex-wrap gap-2">
        <StatusBadge map={t.classGroup.status} value={entry.classGroup.status} />
        <StatusBadge map={t.learn.enrollment} value={entry.enrollmentState} tone={activeHere ? "strong" : "neutral"} />
      </p>
      {activeHere && lessons !== null && lessons.total > 0 && (
        <div className="mt-4">
          <ProgressBar value={lessons.completed / lessons.total} label={fmt(t.classGroup.lessonsOf, { completed: lessons.completed, total: lessons.total })} />
        </div>
      )}
      {activeHere && (attendance !== null || nextSession) && (
        <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          {attendance !== null && (
            <div className="flex items-center justify-between gap-2 sm:block">
              <dt className="text-muted-foreground">{t.classGroup.progressAttendance}</dt>
              <dd className="font-medium tabular-nums">{percent(attendance)}</dd>
            </div>
          )}
          {nextSession && (
            <div className="min-w-0">
              <dt className="text-muted-foreground">{t.dashboard.nextSession}</dt>
              <dd className="truncate font-medium">
                <time dateTime={nextSession.startsAt}>{sessionTime(nextSession.startsAt)}</time>
              </dd>
            </div>
          )}
        </dl>
      )}
      {activeHere && (
        <p className="mt-4 border-t pt-4">
          <LinkButton href={pages.classGroup(entry.classGroup.id)} variant="primary">
            {t.learn.openClass}
          </LinkButton>
        </p>
      )}
    </DashboardCard>
  );
}

/** Aggregated lessons, attendance and released results across the active classes — live values only. */
function ProgressOverview({
  active,
  progressMap,
}: {
  readonly active: MyLearning["classGroups"];
  readonly progressMap: ReadonlyMap<string, ProgressView>;
}) {
  const { t, fmt, percent } = useWorkspace();
  const loaded = active
    .map((entry) => progressMap.get(entry.classGroup.id))
    .filter((view): view is ProgressView => view !== undefined);
  if (loaded.length === 0) return <EmptyState>{t.common.empty}</EmptyState>;
  const lessons = loaded.reduce(
    (sum, view) => ({ completed: sum.completed + view.progress.lessons.completed, total: sum.total + view.progress.lessons.total }),
    { completed: 0, total: 0 },
  );
  const attended = loaded.reduce((sum, view) => sum + view.progress.attendance.attendedSessions, 0);
  const recorded = loaded.reduce((sum, view) => sum + view.progress.attendance.recordedSessions, 0);
  const assessments = loaded.flatMap((view) => view.progress.assessments);
  const released = assessments.filter((row) => row.bestScorePercent !== null).length;
  return (
    <DashboardCard className="space-y-4">
      {lessons.total > 0 && (
        <ProgressBar value={lessons.completed / lessons.total} label={fmt(t.classGroup.lessonsOf, { completed: lessons.completed, total: lessons.total })} />
      )}
      {recorded > 0 && (
        <ProgressBar value={attended / recorded} label={fmt(t.classGroup.attendanceOf, { percent: percent(attended / recorded) })} />
      )}
      <p className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{t.classGroup.progressAssessments}</span>
        <span className="font-medium tabular-nums">
          {fmt("{released} / {total}", { released, total: assessments.length })}
        </span>
      </p>
    </DashboardCard>
  );
}

/** A quiet warning shown only when this class has remedial activities still assigned. */
function RemediationNudge({
  classGroupId,
  name,
  assigned,
}: {
  readonly classGroupId: string;
  readonly name: string;
  readonly assigned: number;
}) {
  const { t, fmt } = useWorkspace();
  if (assigned === 0) return null;
  return (
    <div className="mt-3">
      <Notice tone="warning">
        {fmt(t.dashboard.remediationNudge, { name })}{" "}
        <TextLink href={pages.classGroup(classGroupId, "practice")}>{t.dashboard.openPractice}</TextLink>
      </Notice>
    </div>
  );
}

/** Open assignments per class group, from the shared incremental hook (no duplicate fetches). */
function DueWorkSection({
  active,
  workMap,
}: {
  readonly active: MyLearning["classGroups"];
  readonly workMap: ReadonlyMap<string, readonly OpenWork[]>;
}) {
  const { t, fmt, sessionTime } = useWorkspace();
  const now = Date.now();
  const withWork = active
    .map((entry) => ({ entry, open: workMap.get(entry.classGroup.id) }))
    .filter((row): row is { entry: (typeof active)[number]; open: readonly OpenWork[] } => row.open !== undefined && row.open.length > 0);
  const settled = active.every((entry) => workMap.has(entry.classGroup.id));
  if (withWork.length === 0) {
    return settled ? (
      <EmptyState>{t.learn.noWork}</EmptyState>
    ) : (
      <div aria-hidden="true" className="min-h-24 animate-pulse rounded-2xl border bg-muted/40 motion-reduce:animate-none" />
    );
  }
  return (
    <div className="space-y-4">
      {withWork.map(({ entry, open }) => (
        <DashboardCard key={entry.classGroup.id}>
          <h3 className="mb-3 font-serif text-lg">{entry.classGroup.name}</h3>
          <ul className="space-y-3">
            {open.map((item) => {
              const dueSoon = item.dueAt !== null && Date.parse(item.dueAt) - now < 72 * 3600e3;
              return (
                <li key={item.id} className="rounded-xl border p-3">
                  <p className="flex flex-wrap items-center justify-between gap-2">
                    <TextLink href={pages.assignment(item.id)}>{item.title}</TextLink>
                    <span className="flex flex-wrap items-center gap-2">
                      {item.returned && <Badge tone="warning">{t.dashboard.returned}</Badge>}
                      {!item.returned && dueSoon && <Badge tone="warning">{t.dashboard.dueSoon}</Badge>}
                    </span>
                  </p>
                  {item.dueAt && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {fmt(t.common.dueOf, { time: sessionTime(item.dueAt) })}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </DashboardCard>
      ))}
    </div>
  );
}

/** The two most recent announcements the learner can read. */
function LatestAnnouncements() {
  const { t, dateTime } = useWorkspace();
  const { state, reload } = useApi<Announcements>(api.announcements);
  return (
    <ApiView state={state} onRetry={reload}>
      {(items) =>
        items.length === 0 ? (
          <EmptyState>{t.announcements.empty}</EmptyState>
        ) : (
          <ul className="space-y-3">
            {items.slice(0, 2).map((item) => (
              <li key={item.id}>
                <DashboardCard className="p-4">
                  <p className="text-xs text-muted-foreground">
                    <time dateTime={item.publishedAt}>{dateTime(item.publishedAt)}</time>
                  </p>
                  <h3 className="mt-0.5 break-words font-medium">{item.title}</h3>
                  <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground">{item.body}</p>
                </DashboardCard>
              </li>
            ))}
          </ul>
        )
      }
    </ApiView>
  );
}

/** Real unread counts: notifications from the shell's shared request, messages from the thread list. */
function InboxCard() {
  const { t, fmt, number } = useWorkspace();
  const shared = useUnreadNotifications();
  const threads = useApi<Threads>(api.threads);
  const unreadNotifications = shared && shared.state.status === "ready" ? shared.state.data.unreadCount : null;
  const unreadMessages =
    threads.state.status === "ready" ? threads.state.data.reduce((sum, thread) => sum + thread.unread, 0) : null;
  const settled = unreadNotifications !== null && unreadMessages !== null;
  const caughtUp = unreadNotifications === 0 && unreadMessages === 0;
  return (
    <DashboardCard>
      <ul className="space-y-1 text-sm">
        {!settled && (
          <li aria-hidden="true" className="h-4 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        )}
        {settled && caughtUp && <li className="text-muted-foreground">{t.dashboard.allCaughtUp}</li>}
        {unreadMessages !== null && unreadMessages > 0 && (
          <li className="font-medium">{fmt(t.dashboard.unreadMessages, { count: number(unreadMessages) })}</li>
        )}
        {unreadNotifications !== null && unreadNotifications > 0 && (
          <li className="font-medium">{fmt(t.dashboard.unreadNotifications, { count: number(unreadNotifications) })}</li>
        )}
      </ul>
      <p className="mt-3 flex flex-wrap gap-2">
        <LinkButton href={pages.messages}>{t.dashboard.openMessages}</LinkButton>
        <LinkButton href={pages.notifications}>{t.dashboard.openNotifications}</LinkButton>
      </p>
    </DashboardCard>
  );
}

/** Quick actions into the live tabs of the learner's first active class. */
function ContinueLearning({ classGroupId }: { readonly classGroupId: string }) {
  const { t } = useWorkspace();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <QuickAction
        href={pages.classGroup(classGroupId, "lessons")}
        label={t.classGroup.tabs.lessons}
        hint={t.dashboard.lessonsHint}
        icon={<BookOpen className="h-4 w-4" />}
      />
      <QuickAction
        href={pages.classGroup(classGroupId, "readings")}
        label={t.classGroup.tabs.readings}
        hint={t.dashboard.readingsHint}
        icon={<Library className="h-4 w-4" />}
      />
      <QuickAction
        href={pages.classGroup(classGroupId, "practice")}
        label={t.classGroup.tabs.practice}
        hint={t.dashboard.practiceHint}
        icon={<Puzzle className="h-4 w-4" />}
      />
      <QuickAction
        href={pages.classGroup(classGroupId, "recordings")}
        label={t.classGroup.tabs.recordings}
        hint={t.dashboard.recordingsHint}
        icon={<Video className="h-4 w-4" />}
      />
    </div>
  );
}

/** The learner's real certificates, summarized. */
function CertificatesCard() {
  const { t, fmt, number } = useWorkspace();
  const { state, reload } = useApi<MyCertificates>(api.myCertificates);
  return (
    <DashboardCard>
      <p className="flex items-start gap-3">
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Award className="h-4 w-4" />
        </span>
        <span className="text-sm text-muted-foreground">{t.dashboard.certificatesBody}</span>
      </p>
      <ApiView state={state} onRetry={reload}>
        {(rows) => (
          <p className="mt-3 text-sm font-medium">
            {rows.length === 0 ? t.dashboard.noCertificates : fmt(t.dashboard.certificatesCount, { count: number(rows.length) })}
          </p>
        )}
      </ApiView>
      <p className="mt-3">
        <LinkButton href={pages.certificates}>{t.dashboard.openCertificates}</LinkButton>
      </p>
    </DashboardCard>
  );
}
