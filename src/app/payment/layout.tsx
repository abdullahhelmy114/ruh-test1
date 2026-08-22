export const runtime = 'edge';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payment | Ruh-Ul-Qudus Academy",
  description: "Secure payment page.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}