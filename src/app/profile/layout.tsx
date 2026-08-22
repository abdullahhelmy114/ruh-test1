import type { Metadata } from "next";
import { ProfileShell } from "@/components/profile/ProfileShell";

export const metadata: Metadata = {
  title: "Profile | Ruh-Ul-Qudus Academy",
  description: "Your profile settings.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <ProfileShell>{children}</ProfileShell>;
}