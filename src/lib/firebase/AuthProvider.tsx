"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./client";
import { authFetch } from "@/lib/authFetch";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  role: "admin" | "teacher" | "student" | null;
  setStoredRole: (role: "teacher" | "student") => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  role: null,
  setStoredRole: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<"admin" | "teacher" | "student" | null>(null);

  // Phase 0: role is UI hint only; it is never persisted to localStorage and
  // never read back from it. The server re-checks role on every request.
  const setStoredRole = (newRole: "teacher" | "student") => {
    setRole(newRole);
  };

  const fetchRoleFromServer = async () => {
    try {
      const res = await authFetch("/api/user");
      const data = await res.json();
      if (data?.profile?.role) {
        const serverRole = data.profile.role as "student" | "teacher" | "admin";
        setRole(serverRole);
        return serverRole;
      }
    } catch (error) {
      console.error("Failed to fetch role from server", error);
    }
    return null;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setRole(null);
        setIsLoading(false);
        return;
      }

      // الدور يأتي من الخادم فقط؛ عند الفشل نفترض "student" (أقل صلاحية)
      const serverRole = await fetchRoleFromServer();
      if (!serverRole) {
        setRole("student");
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, role, setStoredRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}