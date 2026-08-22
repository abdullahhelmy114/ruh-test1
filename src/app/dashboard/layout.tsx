export const runtime = 'edge';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Ruh-Ul-Qudus Academy",
  description: "User dashboard for Ruh-Ul-Qudus Academy.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}