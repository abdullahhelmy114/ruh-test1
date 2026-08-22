export const runtime = 'edge';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wishlist | Ruh-Ul-Qudus Academy",
  description: "Your saved courses.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}