// src/app/library/book/detail/page.tsx
import { Suspense } from "react";
import BookReaderClient from "./client";

export default function BookReaderPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <BookReaderClient />
    </Suspense>
  );
}