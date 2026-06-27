import { z } from "zod";

export const studentSignupSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  countryOfResidence: z.string().optional(),
  nationality: z.string().optional(),
  gender: z.string().optional(),
  languages: z.array(
    z.object({
      code: z.string().min(1),
      proficiency: z.enum(["native", "beginner", "intermediate", "advanced"]),
    })
  ).nonempty("Add at least one language"),   // ← إلزامية وغير قابلة لـ undefined
  email: z.string().email("Invalid email"),
  whatsapp: z.string().optional(),
  interests: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password confirmation is required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type StudentSignupData = z.infer<typeof studentSignupSchema>;