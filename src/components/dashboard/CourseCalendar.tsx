import { Calendar, Video, Clock, BookOpen } from "lucide-react";

const sessions = [
  { day: "Mon", date: "12", time: "10:00 AM", topic: "Verb Conjugation — Present Tense", level: "B1", joinable: true },
  { day: "Wed", date: "14", time: "06:00 PM", topic: "Quranic Vocabulary Workshop", level: "B2", joinable: false },
  { day: "Thu", date: "15", time: "09:00 AM", topic: "Conversation Practice — Travel", level: "A2", joinable: false },
  { day: "Sat", date: "17", time: "11:30 AM", topic: "Advanced Grammar — Iʿrāb", level: "C1", joinable: false },
];

export function CourseCalendar({ canJoin = true }: { canJoin?: boolean }) {
  return (
    <div className="rounded-3xl border bg-card p-6 shadow-elegant">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-gold">
            <Calendar className="h-4 w-4" /> Live Sessions
          </div>
          <h3 className="mt-1 font-serif text-2xl">Upcoming Zoom Calendar</h3>
        </div>
        <button className="hidden rounded-full border px-4 py-2 text-xs font-medium hover:bg-accent md:inline-flex">
          View Month
        </button>
      </div>

      <div className="space-y-3">
        {sessions.map((s, i) => (
          <div
            key={i}
            className="group flex items-center gap-4 rounded-2xl border bg-background p-4 transition hover:border-gold/40 hover:shadow-gold"
          >
            <div className="grid h-14 w-14 flex-none place-items-center rounded-2xl gradient-emerald text-primary-foreground">
              <div className="text-center leading-tight">
                <div className="text-[10px] uppercase tracking-wider opacity-70">{s.day}</div>
                <div className="font-serif text-xl">{s.date}</div>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{s.topic}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {s.time}</span>
                <span className="rounded-full bg-accent px-2 py-0.5">Level {s.level}</span>
                <a className="inline-flex items-center gap-1 text-gold hover:underline">
                  <BookOpen className="h-3 w-3" /> Curriculum Planner
                </a>
              </div>
            </div>
            <button
              disabled={!canJoin || !s.joinable}
              className="inline-flex flex-none items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Video className="h-3.5 w-3.5" /> Join Zoom
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
