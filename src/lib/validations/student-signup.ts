import * as z from "zod";

export const studentSignupSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  countryOfResidence: z.string().min(1, "Country is required"),
  nationality: z.string().min(1, "Nationality is required"),
  gender: z.string().min(1, "Gender is required"),
  languages: z.array(
    z.object({
      code: z.string().min(1, "Language is required"),
      proficiency: z.enum(["native", "beginner", "intermediate", "advanced"]),
    })
  ).min(1, "At least one language is required"),
  email: z.string().email("Invalid email address"),
  whatsapp: z.string().min(8, "WhatsApp number is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type StudentSignupData = z.infer<typeof studentSignupSchema>;