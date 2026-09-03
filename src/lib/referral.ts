import { randomBytes } from "crypto";

/**
 * توليد كود إحالة فريد مكوّن من 8 أحرف سداسية عشرية كبيرة.
 * مثال: A1B2C3D4
 */
export function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}