"use client";

import dynamic from "next/dynamic";

const AuthProvider = dynamic(
  () => import("./AuthProvider").then((mod) => mod.AuthProvider),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    ),
  }
);

export default function AuthProviderLazy({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}