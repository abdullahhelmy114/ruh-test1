export const runtime = 'edge';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Subscriptions | Ruh-Ul-Qudus Academy",
  description: "Manage your subscriptions.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SubscriptionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}