import type { Metadata } from "next";
import Link from "next/link";
import { publicLocale } from "@/components/academy/public-locale";
import { DomainError } from "@/lib/academy/domain/errors";
import { publicService } from "@/lib/academy/server";

// Public academy catalog. Functional layout only; visual design comes later.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Programs and courses | Ruh-Ul-Qudus Academy",
  description: "Browse the programs and courses taught at Ruh-Ul-Qudus Academy.",
};

export default async function AcademyCatalogPage() {
  const { t } = await publicLocale();
  let catalog: Awaited<ReturnType<typeof publicService.catalog>> | null = null;
  try {
    catalog = await publicService.catalog();
  } catch (error) {
    if (!(error instanceof DomainError && error.code === "FEATURE_UNAVAILABLE")) throw error;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">{t.catalogTitle}</h1>
        <p className="mt-2 text-muted-foreground">{t.catalogIntro}</p>
      </header>

      {catalog === null ? (
        <p role="status" className="rounded-md border p-4">{t.notAvailable}</p>
      ) : (
        <>
          {catalog.programs.length > 0 && (
            <section aria-labelledby="programs-heading" className="mb-10">
              <h2 id="programs-heading" className="mb-4 text-xl font-semibold">{t.programsHeading}</h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {catalog.programs.map((program) => (
                  <li key={program.slug} className="rounded-md border p-4">
                    <h3 className="font-medium">
                      <Link href={`/academy/programs/${program.slug}`} className="underline-offset-4 hover:underline focus-visible:underline">
                        {program.title}
                      </Link>
                    </h3>
                    {program.description && <p className="mt-1 text-sm text-muted-foreground">{program.description}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="courses-heading">
            <h2 id="courses-heading" className="mb-4 text-xl font-semibold">{t.coursesHeading}</h2>
            {catalog.courses.length === 0 ? (
              <p role="status" className="rounded-md border p-4">{t.noCourses}</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {catalog.courses.map((course) => (
                  <li key={course.slug} className="rounded-md border p-4">
                    <h3 className="font-medium">
                      <Link href={`/academy/courses/${course.slug}`} className="underline-offset-4 hover:underline focus-visible:underline">
                        {course.title}
                      </Link>
                    </h3>
                    {course.program && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.partOfProgram}:{" "}
                        <Link href={`/academy/programs/${course.program.slug}`} className="underline-offset-4 hover:underline focus-visible:underline">
                          {course.program.title}
                        </Link>
                      </p>
                    )}
                    {course.description && <p className="mt-2 text-sm text-muted-foreground">{course.description}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
