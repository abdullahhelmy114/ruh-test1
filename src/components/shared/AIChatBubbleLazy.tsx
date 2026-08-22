"use client";

import dynamic from "next/dynamic";

const AIChatBubble = dynamic(
  () => import("./AIChatBubble").then((mod) => mod.AIChatBubble),
  {
    ssr: false,
    loading: () => null,
  }
);

export default function AIChatBubbleLazy() {
  return <AIChatBubble />;
}