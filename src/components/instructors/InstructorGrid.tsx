"use client";

import { useEffect, useState } from "react";
import InstructorCard from "./InstructorCard";
import type { Instructor } from "@/types/student-features";

export default function InstructorGrid() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadInstructors = async () => {
      try {
        const res = await fetch("/api/instructors");
        if (!res.ok) throw new Error("Failed to load instructors");
        const data = await res.json();
        setInstructors(data.instructors ?? []);
      } catch (err) {
        setError("Unable to load instructors at this time.");
      } finally {
        setIsLoading(false);
      }
    };

    loadInstructors();
  }, []);

  if (isLoading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[4/3] animate-pulse rounded-2xl bg-charcoal/5"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-charcoal/10 bg-white/80 p-12 text-center">
        <p className="text-charcoal/70">{error}</p>
      </div>
    );
  }

  if (instructors.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-charcoal/20 bg-white/60 p-12 text-center">
        <p className="font-serif text-xl font-semibold text-charcoal/70">
          No instructors yet
        </p>
        <p className="mt-2 text-sm text-charcoal/50">
          Our team is being prepared. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {instructors.map((instructor) => (
        <InstructorCard key={instructor.id} instructor={instructor} />
      ))}
    </div>
  );
}