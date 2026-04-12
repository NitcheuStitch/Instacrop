"use client";

import { FORMAT_PRESETS, FORMAT_GROUPS } from "@/lib/formats";
import type { OutputFormat } from "@/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface FormatSelectorProps {
  selected: OutputFormat[];
  onChange: (formats: OutputFormat[]) => void;
}

export function FormatSelector({ selected, onChange }: FormatSelectorProps) {
  const selectedIds = new Set(selected.map((f) => f.id));

  function toggle(format: OutputFormat) {
    if (selectedIds.has(format.id)) {
      onChange(selected.filter((f) => f.id !== format.id));
    } else {
      onChange([...selected, format]);
    }
  }

  return (
    <div className="space-y-4">
      {FORMAT_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
            {group.label}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {FORMAT_PRESETS.filter((f) => group.ids.includes(f.id)).map((format) => {
              const isSelected = selectedIds.has(format.id);
              return (
                <button
                  key={format.id}
                  onClick={() => toggle(format)}
                  className={cn(
                    "relative flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-all duration-100",
                    isSelected
                      ? "border-brand-500 bg-brand-500/10"
                      : "border-neutral-700 bg-neutral-900 hover:border-neutral-500"
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-brand-500 flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                  <span className="text-sm font-medium text-neutral-100">{format.label}</span>
                  <span className="text-xs text-neutral-500">
                    {format.width}×{format.height}
                  </span>
                  <span className="text-xs text-neutral-600">{format.platform}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
