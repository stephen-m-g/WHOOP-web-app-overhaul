"use client";

import type { JumpType } from "@/lib/api";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS: Array<{ value: JumpType; label: string }> = [
  { value: "vertical", label: "Vertical" },
  { value: "broad", label: "Broad" },
];

interface JumpTypeToggleProps {
  value: JumpType;
  onChange: (value: JumpType) => void;
}

export function JumpTypeToggle({ value, onChange }: JumpTypeToggleProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TYPE_OPTIONS.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            className={cn(
              "cursor-pointer rounded-full px-2.5 py-1 text-xs ring-1 transition-colors",
              isActive
                ? "bg-jump-trainer-accent font-semibold text-white ring-jump-trainer-accent"
                : "font-normal text-muted-foreground ring-foreground/15 hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
