"use client";

import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileSearch,
  GraduationCap,
  Layers,
  Users,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { managePages, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { Overview } from "@/components/academy/workspace/admin/types";
import { useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { ApiView, Notice, PageHeader, Section, TextLink } from "@/components/academy/workspace/ui";

/** An icon per real count; anything unmapped falls back to the chart glyph. */
const COUNT_ICONS: Readonly<Record<string, LucideIcon>> = {
  programs: Layers,
  courses: BookOpen,
  open_class_groups: Users,
  class_groups_without_teacher: Users,
  active_enrollments: GraduationCap,
  pending_enrollments: GraduationCap,
  upcoming_sessions: CalendarDays,
  curriculum_reviews: FileSearch,
  lesson_script_reviews: FileSearch,
  assessment_reviews: FileSearch,
  attempts_needing_review: ClipboardCheck,
  recordings_in_review: Video,
  open_approval_requests: ClipboardCheck,
};

// Administration overview: real counts from the academy database and the
// academy settings that still have no value (their features fail closed).
export default function ManageOverviewPage() {
  const text = useAdminText();
  const { number } = useWorkspace();
  const { state, reload } = useApi<Overview>(adminApi.overview);
  return (
    <>
      <PageHeader title={text.overview.title} intro={text.overview.intro} />
      <ApiView state={state} onRetry={reload}>
        {(overview) => (
          <>
            <Section title={text.nav.overview}>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(Object.keys(text.overview.counts) as (keyof typeof text.overview.counts)[]).map((key, index) => {
                  const Icon = COUNT_ICONS[key] ?? BarChart3;
                  return (
                    <li key={key}>
                      <div className="relative overflow-hidden rounded-3xl border bg-card p-5 shadow-elegant">
                        <div
                          aria-hidden="true"
                          className={`absolute inset-0 bg-linear-to-br ${index % 2 === 0 ? "from-primary/15" : "from-accent/25"} to-transparent opacity-60`}
                        />
                        <div className="relative">
                          <div aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-background/80">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <p className="mt-3 font-serif text-3xl tabular-nums">{number(overview.counts[key] ?? 0)}</p>
                          <p className="text-xs uppercase tracking-wider rtl:tracking-normal text-muted-foreground">{text.overview.counts[key]}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 flex flex-wrap gap-4 text-sm">
                <TextLink href={managePages.reviewQueue}>{text.nav.reviewQueue}</TextLink>
                <TextLink href={managePages.gates}>{text.nav.gates}</TextLink>
              </p>
            </Section>
            <Section title={text.overview.unconfigured}>
              {overview.unconfiguredAcademyPolicies.length === 0 ? (
                <Notice tone="success">{text.overview.allConfigured}</Notice>
              ) : (
                <>
                  <Notice tone="warning">{text.overview.unconfiguredHint}</Notice>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {overview.unconfiguredAcademyPolicies.map((key) => (
                      <li key={key}>
                        <code dir="ltr" className="rounded border px-2 py-1 text-sm">{key}</code>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3">
                    <TextLink href={managePages.policies}>{text.nav.policies}</TextLink>
                  </p>
                </>
              )}
            </Section>
          </>
        )}
      </ApiView>
    </>
  );
}
