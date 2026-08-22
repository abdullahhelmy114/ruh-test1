export const runtime = 'edge';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cart | Ruh-Ul-Qudus Academy",
  description: "Your shopping cart.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}