// lib/validations/teacher-signup-step1.ts
import { z } from "zod";

export const teacherSignupStep1Schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  age: z.string().min(1, "Age is required"),
  countryOfResidence: z.string().min(1, "Country of residence is required"),
  nationality: z.string().min(1, "Nationality is required"),
  // بدلاً من z.enum نستخدم string مع refine
  gender: z.string().min(1, "Gender is required").refine(
    (val) => ["male", "female", "other"].includes(val),
    { message: "Please select a valid gender" }
  ),
  languages: z
    .array(
      z.object({
        code: z.string().min(1, "Language code is required"),
        proficiency: z.enum(["native", "beginner", "intermediate", "advanced"]),
      })
    )
    .min(1, "At least one language is required")
    .refine(
      (langs) => langs.some((l) => l.proficiency === "native"),
      "You must select at least one native language"
    ),
  email: z.string().email("Invalid email"),
  whatsapp: z.string().min(1, "WhatsApp number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password confirmation is required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type TeacherSignupStep1Data = z.infer<typeof teacherSignupStep1Schema>;