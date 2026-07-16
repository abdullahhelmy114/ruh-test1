// src/lib/fetchWithAuth.ts
import { useAuth } from "@/lib/firebase/AuthProvider";

export function useAuthenticatedFetch() {
  const { user } = useAuth();

  return async (url: string, options: RequestInit = {}) => {
    const token = user ? await user.getIdToken() : null;
    const headers = {
      ...options.headers,
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    };
    return fetch(url, { ...options, headers });
  };
}