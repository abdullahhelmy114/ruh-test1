"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api } from "@/components/academy/workspace/paths";
import type { Book, BookPage, ReadingProgress } from "@/components/academy/workspace/types";
import { ApiView, Button, Card, EmptyState, Field, LinkButton, Loading, Notice, PageHeader, TextInput } from "@/components/academy/workspace/ui";

export default function BookReaderPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BookReader />
    </Suspense>
  );
}

// A library book for a reader. The server grants the whole book or only
// linked page ranges, and never sends pages (or the book file) outside them.
function BookReader() {
  const { bookId } = useParams<{ bookId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { t } = useWorkspace();
  const { state, reload } = useApi<Book>(api.book(bookId));
  const progress = useApi<ReadingProgress>(api.bookProgress(bookId));
  const requested = Number(search.get("page"));

  return (
    <ApiView state={state} onRetry={reload}>
      {(book) => (
        <>
          <PageHeader
            title={book.book.title}
            intro={book.book.author}
            actions={
              <Button type="button" variant="ghost" onClick={() => router.back()}>
                {t.library.back}
              </Button>
            }
          />
          {book.pages.length === 0 ? (
            <EmptyState>{t.library.noPages}</EmptyState>
          ) : (
            <Reader
              book={book}
              initialPage={Number.isInteger(requested) && book.pages.some((p) => p.pageNumber === requested) ? requested : progress.state.status === "ready" && progress.state.data ? progress.state.data.lastPage : book.pages[0].pageNumber}
            />
          )}
        </>
      )}
    </ApiView>
  );
}

function Reader({ book, initialPage }: { readonly book: Book; readonly initialPage: number }) {
  const { t, fmt } = useWorkspace();
  const allowed = book.pages.map((p) => p.pageNumber);
  const [pageNumber, setPageNumber] = useState(allowed.includes(initialPage) ? initialPage : allowed[0]);
  const [goTo, setGoTo] = useState("");
  const [savedPage, setSavedPage] = useState<number | null>(null);
  const page = useApi<BookPage>(api.bookPage(book.book.id, pageNumber));
  const saver = useAction();
  const index = allowed.indexOf(pageNumber);

  useEffect(() => {
    setSavedPage(null);
  }, [pageNumber]);

  async function remember() {
    const result = await saver.run(api.bookProgress(book.book.id), "PUT", { lastPage: pageNumber });
    if (result.ok) setSavedPage(pageNumber);
  }

  function jump(event: FormEvent) {
    event.preventDefault();
    const target = Number(goTo);
    if (allowed.includes(target)) setPageNumber(target);
  }

  const access = book.book.access;
  return (
    <div className="space-y-4">
      <Notice>
        {access.kind === "full" ? t.library.full : fmt(t.library.ranges, { ranges: access.ranges.map((r) => (r.from === r.to ? `${r.from}` : `${r.from}–${r.to}`)).join(", ") })}
      </Notice>
      {book.book.pdfUrl && (
        <p>
          <LinkButton href={book.book.pdfUrl} external>
            {t.library.file}
          </LinkButton>
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Button type="button" variant="outline" disabled={index <= 0} onClick={() => setPageNumber(allowed[index - 1])}>
          {t.library.previous}
        </Button>
        <span className="px-2 text-sm" aria-live="polite">
          {fmt(t.library.page, { page: pageNumber })}
        </span>
        <Button type="button" variant="outline" disabled={index >= allowed.length - 1} onClick={() => setPageNumber(allowed[index + 1])}>
          {t.library.next}
        </Button>
        <form onSubmit={jump} className="flex items-end gap-2">
          <Field label={t.library.goTo} htmlFor="go-to-page">
            <TextInput id="go-to-page" type="number" inputMode="numeric" min={1} className="w-24" value={goTo} onChange={(e) => setGoTo(e.target.value)} />
          </Field>
          <Button type="submit" variant="ghost">
            {t.common.open}
          </Button>
        </form>
        <Button type="button" variant="ghost" busy={saver.busy} onClick={() => void remember()}>
          {t.library.savePosition}
        </Button>
        {savedPage === pageNumber && <span role="status" className="text-sm text-muted-foreground">{t.library.positionSaved}</span>}
      </div>
      <ApiView state={page.state} onRetry={page.reload}>
        {(data) => (
          <Card>
            {/* eslint-disable-next-line @next/next/no-img-element -- page images are served from the library's storage */}
            <img src={data.imageUrl} alt={fmt(t.library.page, { page: data.pageNumber })} className="mx-auto h-auto max-w-full" referrerPolicy="no-referrer" />
            {data.text && (
              <details className="mt-3">
                <summary className="cursor-pointer">{t.lesson.transcript}</summary>
                <p className="mt-2 whitespace-pre-line" dir="auto">
                  {data.text}
                </p>
              </details>
            )}
          </Card>
        )}
      </ApiView>
    </div>
  );
}
