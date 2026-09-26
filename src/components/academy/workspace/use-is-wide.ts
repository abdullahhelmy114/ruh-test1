"use client";

import { useSyncExternalStore } from "react";

/*
 * True at the md breakpoint and above. useSyncExternalStore renders the
 * server snapshot (false) during hydration and re-renders once the real
 * viewport is known, so server and first client render always agree — the
 * hydration property the signup guard protects, by construction.
 */
const QUERY = "(min-width: 768px)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function snapshot(): boolean {
  return typeof window === "undefined" ? false : window.matchMedia(QUERY).matches;
}

export function useIsWide(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
