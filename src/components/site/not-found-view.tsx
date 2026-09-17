import Link from "next/link";
import { publicLocale } from "@/components/academy/public-locale";

/**
 * The body of every 404 the site serves, in the reader's language.
 *
 * It renders no <html> or <body>: those come from the root layout, which is
 * what puts the right lang and dir on the document. A not-found file that
 * supplies its own document falls outside the layout and loses both.
 */
export async function NotFoundView() {
  const { t } = await publicLocale();
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-medium tracking-[0.2em] text-muted-foreground">404</p>
      <h1 className="mt-3 font-serif text-2xl text-foreground">{t.pageNotFoundTitle}</h1>
      <p className="mt-3 text-muted-foreground">{t.pageNotFoundBody}</p>
      <Link href="/" className="mt-6 text-sm underline underline-offset-4 hover:no-underline focus-visible:no-underline">
        {t.backToHome}
      </Link>
    </div>
  );
}
