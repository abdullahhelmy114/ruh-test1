"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { NETWORK_FAILURE, dataOf, failureFromResponse, type ApiFailure } from "@/lib/academy/workspace/api-errors";

/**
 * Data access for the workspace screens. Every call goes to the academy API
 * with the signed-in user's token; the server decides what the caller may see
 * or do. Nothing here caches responses.
 */

export type ApiResult<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly failure: ApiFailure };

export type ApiState<T> =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly data: T }
  | { readonly status: "failed"; readonly failure: ApiFailure };

const UNAUTHENTICATED: ApiFailure = Object.freeze({ kind: "unauthenticated", status: 401, message: null });

export async function requestJson<T>(url: string, init: { readonly method?: string; readonly body?: unknown } = {}): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await authFetch(url, {
      method: init.method ?? "GET",
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, failure: NETWORK_FAILURE };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, failure: failureFromResponse(response.status, body) };
  try {
    return { ok: true, data: dataOf<T>(body) };
  } catch {
    return { ok: false, failure: failureFromResponse(500, null) };
  }
}

/** Loads a resource once auth is known; `url === null` waits (for example until a choice is made). */
export function useApi<T>(url: string | null): { readonly state: ApiState<T>; readonly reload: () => void } {
  const { user, isLoading } = useAuth();
  const [state, setState] = useState<ApiState<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setState({ status: "failed", failure: UNAUTHENTICATED });
      return;
    }
    if (url === null) return;
    let cancelled = false;
    // Keep showing loaded data while refreshing; show loading only the first time.
    setState((previous) => (previous.status === "ready" ? previous : { status: "loading" }));
    requestJson<T>(url).then((result) => {
      if (cancelled) return;
      setState(result.ok ? { status: "ready", data: result.data } : { status: "failed", failure: result.failure });
    });
    return () => {
      cancelled = true;
    };
  }, [url, user, isLoading, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { state, reload };
}

/** A write with a busy flag and the last failure, for forms and command buttons. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const run = useCallback(async <T,>(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<ApiResult<T>> => {
    setBusy(true);
    setFailure(null);
    const result = await requestJson<T>(url, { method, body });
    setBusy(false);
    if (!result.ok) setFailure(result.failure);
    return result;
  }, []);

  const clear = useCallback(() => setFailure(null), []);
  return { busy, failure, run, clear };
}
