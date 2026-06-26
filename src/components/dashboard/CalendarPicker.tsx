"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarPickerProps {
  selected: Date | null;
  onChange: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}

export function CalendarPicker({ selected, onChange, minDate, maxDate }: CalendarPickerProps) {
  const today = new Date();
  const min = minDate || new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000); // بعد أسبوع
  const [viewMonth, setViewMonth] = React.useState(min.getMonth());
  const [viewYear, setViewYear] = React.useState(min.getFullYear());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun

  const isDisabled = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    if (min && d < new Date(min.getFullYear(), min.getMonth(), min.getDate())) return true;
    if (maxDate && d > maxDate) return true;
    return false;
  };

  const isSelected = (day: number) =>
    selected &&
    selected.getFullYear() === viewYear &&
    selected.getMonth() === viewMonth &&
    selected.getDate() === day;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => { 
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1 rounded-full hover:bg-accent"><ChevronLeft size={16} /></button>
        <div className="font-medium text-sm">
          {new Date(viewYear, viewMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </div>
        <button onClick={nextMonth} className="p-1 rounded-full hover:bg-accent"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => <div key={"e"+i} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const disabled = isDisabled(day);
          const selectedDay = isSelected(day);
          return (
            <button
              key={day}
              disabled={disabled}
              onClick={() => !disabled && onChange(new Date(viewYear, viewMonth, day))}
              className={cn(
                "h-9 w-9 rounded-full text-sm transition-colors",
                disabled && "text-muted-foreground/30 cursor-not-allowed",
                selectedDay && "bg-emerald-600! text-white! ring-2 ring-emerald-400 ring-offset-1",
                !disabled && !selectedDay && "hover:bg-accent"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}