"use client";

import { useEffect, useState, useCallback } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { OutputCard } from "@/components/results/output-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { JobWithOutputs, DbOutput } from "@/types";
import { Download, ArrowLeft, RefreshCw, ImageIcon } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

const POLL_INTERVAL_MS = 3000;

export default function ResultsPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<JobWithOutputs | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) {
      setError("Job not found.");
      return;
    }
    const { job: data } = await res.json();
    setJob(data);
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Poll while job is still running
  useEffect(() => {
    if (!job) return;
    const terminal = ["completed", "failed", "partial"];
    if (terminal.includes(job.status)) return;

    const timer = setInterval(fetchJob, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [job, fetchJob]);

  async function handleDownloadAll() {
    setDownloading(true);
    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `instacrop_${jobId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  // Group outputs by format
  const outputsByFormat = job?.outputs.reduce<Record<string, DbOutput[]>>(
    (acc, output) => {
      const key = `${output.format_name} (${output.width}×${output.height})`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(output);
      return acc;
    },
    {}
  ) ?? {};

  const completedCount = job?.outputs.filter((o) => o.status === "done").length ?? 0;
  const totalCount = job?.outputs.length ?? 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-400 mb-4">{error ?? "Something went wrong."}</p>
          <Button onClick={() => router.push("/dashboard")} variant="secondary">
            Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-8">
            <div className="flex items-start gap-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="mt-0.5 p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">{job.original_filename}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-neutral-500">
                    {formatRelativeTime(job.created_at)}
                  </span>
                  <JobStatusBadge status={job.status} />
                  {totalCount > 0 && (
                    <span className="text-xs text-neutral-600">
                      {completedCount}/{totalCount} done
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchJob}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
              {completedCount > 0 && (
                <Button size="sm" onClick={handleDownloadAll} loading={downloading}>
                  <Download className="h-3.5 w-3.5" />
                  Download all ({completedCount})
                </Button>
              )}
            </div>
          </div>

          {/* Source image + settings summary */}
          <div className="p-5 rounded-2xl border border-white/8 bg-neutral-900/30 mb-10">
            <div className="grid md:grid-cols-[auto_1fr] gap-6">
              {/* Images: original + cutout if used */}
              <div className="flex gap-3">
                <div>
                  <p className="text-xs text-neutral-600 mb-1.5">Original</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={job.original_image_url}
                    alt="Source image"
                    className="h-24 w-24 object-contain rounded-xl border border-white/10 bg-neutral-800"
                  />
                </div>
                {job.settings_json.useProductCutout && job.settings_json.productCutoutUrl && (
                  <div>
                    <p className="text-xs text-brand-400 mb-1.5">Product used</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={job.settings_json.productCutoutUrl}
                      alt="Product cutout"
                      className="h-24 w-24 object-contain rounded-xl border border-brand-500/30 bg-neutral-800"
                    />
                  </div>
                )}
              </div>
              {/* Settings */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 content-start">
                <Info label="Source" value={job.settings_json.useProductCutout ? "Product cutout" : "Full image"} />
                <Info label="Mode" value={job.settings_json.mode.replace(/_/g, " ")} />
                <Info label="Style" value={job.settings_json.backgroundStyle} />
                <Info label="Variants" value={String(job.settings_json.variantCount)} />
                <Info label="Formats" value={String(job.settings_json.formats.length)} />
                <Info label="Status" value={job.status} />
              </div>
            </div>
          </div>

          {/* Outputs grouped by format */}
          {Object.keys(outputsByFormat).length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-white/8">
              <ImageIcon className="h-8 w-8 text-neutral-600 mx-auto mb-3" />
              <p className="text-neutral-400">Generating your creatives...</p>
            </div>
          ) : (
            <div className="space-y-10">
              {Object.entries(outputsByFormat).map(([formatLabel, outputs]) => (
                <div key={formatLabel}>
                  <h2 className="text-sm font-medium text-neutral-400 mb-4">{formatLabel}</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {outputs.map((output) => (
                      <OutputCard key={output.id} output={output} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-600 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-neutral-200 capitalize mt-0.5">{value}</p>
    </div>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "warning" | "error" | "info" | "default" }> = {
    completed: { label: "Completed", variant: "success" },
    processing: { label: "Processing", variant: "info" },
    pending: { label: "Pending", variant: "default" },
    failed: { label: "Failed", variant: "error" },
    partial: { label: "Partial", variant: "warning" },
  };
  const entry = map[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
