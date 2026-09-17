import { redirect } from "next/navigation";

// Retired. This screen's approve button called a route that updated a table the
// application does not have, and its reject button only hid the card. Teacher
// applications are reviewed in the academy administration, where approval
// activates the account in one guarded transaction with a recorded history.
export default function TeacherVerificationPage() {
  redirect("/academy/manage/teachers");
}
