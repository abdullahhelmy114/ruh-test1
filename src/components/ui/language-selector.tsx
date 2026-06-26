"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LANGUAGES } from "@/lib/constants/teacher-signup";

interface LanguageSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function LanguageSelect({
  value,
  onChange,
  placeholder = "Select language...",
}: LanguageSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedLang = LANGUAGES.find((l) => l.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedLang ? selectedLang.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[200px] p-0 bg-popover border shadow-md"
        align="start"
        sideOffset={4}
      >
        <Command>
          <CommandInput placeholder="Search language..." />
          <CommandEmpty>No language found.</CommandEmpty>
          <CommandGroup>
            {LANGUAGES.map((lang) => (
              <CommandItem
                key={lang.code}
                value={lang.name}
                onSelect={() => {
                  onChange(lang.code);
                  setOpen(false);
                }}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === lang.code ? "opacity-100" : "opacity-0"
                  )}
                />
                {lang.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}