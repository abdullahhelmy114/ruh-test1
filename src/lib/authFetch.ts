// lib/authFetch.ts
import { getAuth } from "firebase/auth";

/**
 * دالة fetch مخصصة ترسل تلقائياً رمز Firebase الحالي في رأس Authorization.
 * تتعامل مع طلبات JSON و FormData و DELETE بدون جسم.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const auth = getAuth();
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  const headers = new Headers(options.headers || {});

  // إضافة رمز المصادقة إذا وُجد
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // تعيين Content-Type افتراضياً لـ JSON فقط إذا لم يكن الطلب FormData
  // وإذا لم يتم تعيينه بالفعل
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    // لطلبات GET و DELETE لا نحتاج Content-Type
    if (options.method && (options.method.toUpperCase() === "POST" || options.method.toUpperCase() === "PUT" || options.method.toUpperCase() === "PATCH")) {
      headers.set("Content-Type", "application/json");
    }
  }

  return fetch(url, { ...options, headers });
}