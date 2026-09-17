import { redirect } from "next/navigation";

// The former second step of teacher signup kept the password in session
// storage between pages. Signup is now one form at /signup/teacher.
export default function TeacherSignupDetailsPage() {
  redirect("/signup/teacher");
}
