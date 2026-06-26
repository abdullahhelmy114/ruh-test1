"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { T } from "@/components/TranslatedText";

export function ResendVerificationButton() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleResend = async () => {
    if (!email) {
      setMessage("No email found. Please go back to sign up.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/send-verification-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) setMessage("Code resent successfully!");
      else setMessage(data.error || "Failed to resend.");
    } catch {
      setMessage("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleResend} disabled={loading} className="text-sm underline text-amber-600">
        {loading ? "Resending..." : <T>Resend Code</T>}
      </button>
      {message && <p className="text-xs mt-1 text-muted-foreground">{message}</p>}
    </div>
  );
}