"use client";

import { Download, Loader2, AlertCircle } from "lucide-react";
import type { DbOutput } from "@/types";
import { Badge } from "@/components/ui/badge";

interface OutputCardProps {
  output: DbOutput;
}

export function OutputCard({ output }: OutputCardProps) {
  const aspectRatio = output.width / output.height;
  const paddingBottom = `${(1 / aspectRatio) * 100}%`;

  async function handleDownload() {
    if (!output.output_url) return;
    try {
      const res = await fetch(output.output_url);
      if (!res.ok) throw new Error("Failed to fetch image");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${output.format_name}_${output.variant_name}_${output.width}x${output.height}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Download failed silently — URL may have expired
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-neutral-900 overflow-hidden group">
      {/* Image area with correct aspect ratio */}
      <div className="relative w-full bg-neutral-800" style={{ paddingBottom }}>
        {output.status === "done" && output.output_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={output.output_url}
              alt={`${output.format_name} ${output.variant_name}`}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <button
              onClick={handleDownload}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </>
        ) : output.status === "generating" || output.status === "pending" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 text-brand-400 animate-spin" />
            <span className="text-xs text-neutral-500">Generating...</span>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="h-6 w-6 text-red-400" />
            <span className="text-xs text-neutral-500">Failed</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-100 truncate">{output.format_name}</p>
            <p className="text-xs text-neutral-500">{output.width}×{output.height}</p>
          </div>
          <StatusBadge status={output.status} />
        </div>
        <p className="text-xs text-neutral-500">{output.variant_name}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: DbOutput["status"] }) {
  const map: Record<DbOutput["status"], { label: string; variant: "success" | "warning" | "error" | "info" | "default" }> = {
    done: { label: "Done", variant: "success" },
    generating: { label: "Generating", variant: "info" },
    pending: { label: "Queued", variant: "default" },
    failed: { label: "Failed", variant: "error" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}
