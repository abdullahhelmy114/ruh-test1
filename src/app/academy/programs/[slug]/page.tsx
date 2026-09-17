import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { publicLocale } from "@/components/academy/public-locale";
import { DomainError } from "@/lib/academy/domain/errors";
import { publicService } from "@/lib/academy/server";

// Public program page: the program and its active courses only.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

// One lookup per request, shared by the metadata and the page.
const findProgram = cache(async (slug: string) => {
  try {
    return await publicService.program(slug);
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") return "not_found" as const;
    if (error instanceof DomainError && error.code === "FEATURE_UNAVAILABLE") return null;
    throw error;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const program = await findProgram(slug);
  if (program === null || program === "not_found") return { title: "Program | Ruh-Ul-Qudus Academy" };
  return { title: `${program.title} | Ruh-Ul-Qudus Academy`, description: program.description ?? undefined };
}

export default async function AcademyProgramPage({ params }: Props) {
  const { slug } = await params;
  const { t } = await publicLocale();
  const program = await findProgram(slug);
  if (program === "not_found") notFound();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <p className="mb-6">
        <Link href="/academy" className="text-sm underline-offset-4 hover:underline focus-visible:underline">
          {t.backToCatalog}
        </Link>
      </p>

      {program === null ? (
        <p role="status" className="rounded-md border p-4">{t.notAvailable}</p>
      ) : (
        <article>
          <header className="mb-8">
            <p className="text-sm text-muted-foreground">{t.programsHeading}</p>
            <h1 className="mt-1 text-3xl font-semibold">{program.title}</h1>
            {program.description && <p className="mt-3 whitespace-pre-line text-muted-foreground">{program.description}</p>}
          </header>

          <section aria-labelledby="program-courses-heading">
            <h2 id="program-courses-heading" className="mb-4 text-xl font-semibold">{t.programCoursesHeading}</h2>
            {program.courses.length === 0 ? (
              <p role="status" className="rounded-md border p-4">{t.programCoursesEmpty}</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {program.courses.map((course) => (
                  <li key={course.slug} className="rounded-md border p-4">
                    <h3 className="font-medium">
                      <Link href={`/academy/courses/${course.slug}`} className="underline-offset-4 hover:underline focus-visible:underline">
                        {course.title}
                      </Link>
                    </h3>
                    {course.description && <p className="mt-2 text-sm text-muted-foreground">{course.description}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </article>
      )}
    </div>
  );
}
