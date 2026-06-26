import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function RoleToggle({
  value,
  onChange,
}: {
  value: "student" | "teacher";
  onChange: (v: "student" | "teacher") => void;
}) {
  return (
    <div className="relative grid grid-cols-2 rounded-full border bg-muted p-1">
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={cn(
          "absolute inset-y-1 w-1/2 rounded-full gradient-emerald shadow-elegant",
          value === "teacher" ? "left-1/2" : "left-1"
        )}
        style={{ width: "calc(50% - 4px)" }}
      />
      {(["student", "teacher"] as const).map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={cn(
            "relative z-10 rounded-full py-2 text-sm font-medium capitalize transition-colors",
            value === r ? "text-primary-foreground" : "text-muted-foreground"
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
