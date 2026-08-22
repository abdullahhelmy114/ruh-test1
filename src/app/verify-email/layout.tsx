export const runtime = 'edge';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify Email | Ruh-Ul-Qudus Academy",
  description: "Verify your email address.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}