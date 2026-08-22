export const runtime = 'edge';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Referral | Ruh-Ul-Qudus Academy",
  description: "Referral link.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ReferralLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}