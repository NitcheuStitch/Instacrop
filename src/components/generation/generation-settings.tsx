"use client";

import type { GenerationMode, BackgroundStyle, GenerationSettings } from "@/types";
import { cn } from "@/lib/utils";

type CoreSettings = Omit<GenerationSettings, "formats" | "useProductCutout" | "productCutoutUrl">;

interface GenerationSettingsProps {
  settings: CoreSettings;
  onChange: (settings: CoreSettings) => void;
}

const MODES: { id: GenerationMode; label: string; description: string }[] = [
  {
    id: "smart_crop",
    label: "Smart Crop",
    description: "Reframe and crop intelligently for each size",
  },
  {
    id: "background_expand",
    label: "Expand Background",
    description: "Extend the scene around the product",
  },
  {
    id: "recompose",
    label: "Recompose",
    description: "Redesign the layout for each format",
  },
  {
    id: "product_in_scene",
    label: "Product in Scene",
    description: "Place product in a new matching environment",
  },
];

const STYLES: { id: BackgroundStyle; label: string }[] = [
  { id: "studio", label: "Studio" },
  { id: "lifestyle", label: "Lifestyle" },
  { id: "premium", label: "Premium" },
  { id: "vibrant", label: "Vibrant" },
  { id: "minimal", label: "Minimal" },
];

export function GenerationSettingsPanel({ settings, onChange }: GenerationSettingsProps) {
  function update(patch: Partial<typeof settings>) {
    onChange({ ...settings, ...patch });
  }

  return (
    <div className="space-y-6">
      {/* Mode */}
      <div>
        <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider block mb-2">
          Generation Mode
        </label>
        <div className="space-y-2">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => update({ mode: mode.id })}
              className={cn(
                "w-full flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-all",
                settings.mode === mode.id
                  ? "border-brand-500 bg-brand-500/10"
                  : "border-neutral-700 bg-neutral-900 hover:border-neutral-600"
              )}
            >
              <span className="text-sm font-medium text-neutral-100">{mode.label}</span>
              <span className="text-xs text-neutral-500">{mode.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Background Style */}
      <div>
        <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider block mb-2">
          Background Style
        </label>
        <div className="grid grid-cols-3 gap-2">
          {STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => update({ backgroundStyle: style.id })}
              className={cn(
                "rounded-xl border py-2 px-3 text-sm font-medium transition-all",
                settings.backgroundStyle === style.id
                  ? "border-brand-500 bg-brand-500/10 text-brand-300"
                  : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
              )}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>

      {/* Variants */}
      <div>
        <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider block mb-2">
          Variants — {settings.variantCount}
        </label>
        <input
          type="range"
          min={1}
          max={4}
          value={settings.variantCount}
          onChange={(e) => update({ variantCount: parseInt(e.target.value) })}
          className="w-full accent-brand-500"
        />
        <div className="flex justify-between text-xs text-neutral-600 mt-1">
          <span>1</span>
          <span>4</span>
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        <Toggle
          label="Isolate product"
          description="Remove original background for cleaner scene placement"
          checked={settings.isolateProduct}
          onChange={(v) => update({ isolateProduct: v })}
        />
        <Toggle
          label="Preserve composition"
          description="Keep original framing intent when adapting to new sizes"
          checked={settings.preserveComposition}
          onChange={(v) => update({ preserveComposition: v })}
        />
        <Toggle
          label="Use original background as reference"
          description="Use existing background context to guide new generation"
          checked={settings.useOriginalBackground}
          onChange={(v) => update({ useOriginalBackground: v })}
        />
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-200">{label}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "shrink-0 relative h-5 w-9 rounded-full transition-colors duration-150",
          checked ? "bg-brand-600" : "bg-neutral-700"
        )}
      >
        <div
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-150",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}
