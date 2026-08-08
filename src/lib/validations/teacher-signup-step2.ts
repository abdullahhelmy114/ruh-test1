import { z } from "zod";

const socialLinkSchema = z.object({
  platform: z.string().min(1, "Platform name is required"),
  url: z.string().url("Invalid URL").optional().or(z.literal("")),
});

export const teacherSignupStep2Schema = z.object({
  telegram: z.string().min(1, "Telegram username is required"),
  socialLinks: z.array(socialLinkSchema).optional(),
  bio: z.string().min(50, "Bio must be at least 50 characters"),
  cvFile: z.instanceof(File, { message: "CV is required" }).refine(
    (file) => file.type === "application/pdf" || file.name.endsWith(".pdf"),
    "Only PDF files are allowed"
  ).refine(
    (file) => file.size <= 10 * 1024 * 1024,
    "File size must be less than 10 MB"
  ),
  introVideo: z.instanceof(File).optional().refine(
    (file) => !file || file.size <= 50 * 1024 * 1024,
    "Video must be less than 50 MB"
  ),
});

export type TeacherSignupStep2Data = z.infer<typeof teacherSignupStep2Schema>;