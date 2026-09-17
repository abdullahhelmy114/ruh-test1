import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicLocale } from "@/components/academy/public-locale";
import { DomainError } from "@/lib/academy/domain/errors";
import { formatPublicDate } from "@/lib/academy/public/messages";
import { publicService } from "@/lib/academy/server";

// Public course page: published outline titles and upcoming classes only.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function loadCourse(slug: string) {
  try {
    return await publicService.course(slug);
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    if (error instanceof DomainError && error.code === "FEATURE_UNAVAILABLE") return null;
    throw error;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const course = await publicService.course(slug);
    return { title: `${course.title} | Ruh-Ul-Qudus Academy`, description: course.description ?? undefined };
  } catch {
    return { title: "Course | Ruh-Ul-Qudus Academy" };
  }
}

export default async function AcademyCoursePage({ params }: Props) {
  const { slug } = await params;
  const { locale, t } = await publicLocale();
  const course = await loadCourse(slug);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <p className="mb-6">
        <Link href="/academy" className="text-sm underline-offset-4 hover:underline focus-visible:underline">
          {t.backToCatalog}
        </Link>
      </p>

      {course === null ? (
        <p role="status" className="rounded-md border p-4">{t.notAvailable}</p>
      ) : (
        <article>
          <header className="mb-8">
            {course.program && (
              <p className="text-sm text-muted-foreground">
                {t.partOfProgram}:{" "}
                <Link href={`/academy/programs/${course.program.slug}`} className="underline-offset-4 hover:underline focus-visible:underline">
                  {course.program.title}
                </Link>
              </p>
            )}
            <h1 className="mt-1 text-3xl font-semibold">{course.title}</h1>
            {course.description && <p className="mt-3 whitespace-pre-line text-muted-foreground">{course.description}</p>}
          </header>

          <section aria-labelledby="outline-heading" className="mb-10">
            <h2 id="outline-heading" className="mb-4 text-xl font-semibold">{t.outlineHeading}</h2>
            {course.outline.length === 0 ? (
              <p role="status" className="rounded-md border p-4">{t.outlineEmpty}</p>
            ) : (
              <ol className="space-y-4">
                {course.outline.map((unit, index) => (
                  <li key={`${index}-${unit.title}`} className="rounded-md border p-4">
                    <h3 className="font-medium">
                      {index + 1}. {unit.title}
                      <span className="ms-2 text-sm font-normal text-muted-foreground">({unit.lessons.length} {t.lessonsCount})</span>
                    </h3>
                    {unit.lessons.length > 0 && (
                      <ol className="mt-2 list-decimal space-y-1 ps-6 text-sm">
                        {unit.lessons.map((lesson, lessonIndex) => (
                          <li key={`${lessonIndex}-${lesson.title}`}>
                            {lesson.title}
                            {lesson.plannedMinutes !== null && (
                              <span className="ms-2 text-muted-foreground">({lesson.plannedMinutes} {t.minutes})</span>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="classes-heading">
            <h2 id="classes-heading" className="mb-4 text-xl font-semibold">{t.classGroupsHeading}</h2>
            {course.upcomingClassGroups.length === 0 ? (
              <p role="status" className="rounded-md border p-4">{t.classGroupsEmpty}</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {course.upcomingClassGroups.map((group, index) => (
                  <li key={`${index}-${group.name}`} className="rounded-md border p-4">
                    <h3 className="font-medium">{group.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {group.startsOn
                        ? `${t.starts}: ${formatPublicDate(group.startsOn, locale)}${group.endsOn ? ` · ${t.ends}: ${formatPublicDate(group.endsOn, locale)}` : ""}`
                        : t.datesToBeAnnounced}
                    </p>
                    <p className="mt-2 text-sm font-medium">{group.availability === "full" ? t.full : t.open}</p>
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
