"use client";

import { AuthProvider } from "./AuthProvider";

// يلفّ التطبيق بـ AuthProvider مباشرة وبنفس البنية على الخادم وأثناء الـ hydration وبعدها.
// The provider tree must be identical from server render through hydration.
// The former version rendered children alone first and then swapped to a
// next/dynamic AuthProvider after mount, which unmounted and remounted the whole
// page on the client. That remount made React re-create next-themes'
// anti-flash <script> during client rendering ("Encountered a script tag while
// rendering React component"). AuthProvider is client-safe to render directly:
// its Firebase listener runs inside useEffect with cleanup.
export default function AuthProviderLazy({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}
