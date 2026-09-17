"use client";

import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { managePages, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { Overview } from "@/components/academy/workspace/admin/types";
import { useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { ApiView, Card, Notice, PageHeader, Section, TextLink } from "@/components/academy/workspace/ui";

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
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(Object.keys(text.overview.counts) as (keyof typeof text.overview.counts)[]).map((key) => (
                  <li key={key}>
                    <Card>
                      <p className="text-sm text-muted-foreground">{text.overview.counts[key]}</p>
                      <p className="text-2xl font-semibold">{number(overview.counts[key] ?? 0)}</p>
                    </Card>
                  </li>
                ))}
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
