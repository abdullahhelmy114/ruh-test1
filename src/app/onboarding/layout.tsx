export const runtime = 'edge';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Onboarding | Ruh-Ul-Qudus Academy",
  description: "Complete your profile setup.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}