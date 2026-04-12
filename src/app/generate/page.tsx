"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Dropzone } from "@/components/upload/dropzone";
import { FormatSelector } from "@/components/generation/format-selector";
import { GenerationSettingsPanel } from "@/components/generation/generation-settings";
import { Button } from "@/components/ui/button";
import type { GenerationSettings, OutputFormat } from "@/types";
import { FORMAT_PRESETS } from "@/lib/formats";
import { Wand2 } from "lucide-react";

const DEFAULT_SETTINGS: Omit<GenerationSettings, "formats"> = {
  mode: "background_expand",
  backgroundStyle: "studio",
  variantCount: 2,
  isolateProduct: false,
  useOriginalBackground: false,
  preserveComposition: false,
};

export default function GeneratePage() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formats, setFormats] = useState<OutputFormat[]>([
    FORMAT_PRESETS[0], // Instagram Square by default
  ]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);

  function handleFileSelected(f: File, previewUrl: string) {
    setFile(f);
    setPreview(previewUrl);
    setFilename(f.name);
    setError(null);
  }

  function handleClear() {
    setFile(null);
    setPreview(null);
    setFilename(null);
  }

  async function handleGenerate() {
    if (!file) {
      setError("Please upload an image first.");
      return;
    }
    if (formats.length === 0) {
      setError("Please select at least one output format.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // 1. Upload the image
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const { error: uploadError } = await uploadRes.json();
        throw new Error(uploadError ?? "Upload failed");
      }
      const { url, filename: uploadedFilename } = await uploadRes.json();

      // 2. Create the job
      const jobRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalImageUrl: url,
          originalFilename: uploadedFilename,
          settings: { ...settings, formats },
        }),
      });
      if (!jobRes.ok) throw new Error("Failed to create job");
      const { jobId } = await jobRes.json();

      // 3. Kick off generation
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!genRes.ok) throw new Error("Failed to start generation");

      // 4. Navigate to results
      router.push(`/results/${jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const totalOutputs = formats.length * settings.variantCount;

  return (
    <div className="min-h-screen bg-neutral-950">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">New generation</h1>
            <p className="text-neutral-400 text-sm mt-1">
              Upload one image, get multiple ad creatives.
            </p>
          </div>

          <div className="grid lg:grid-cols-[1fr_360px] gap-6">
            {/* Left: upload + formats */}
            <div className="space-y-6">
              {/* Upload */}
              <div className="rounded-2xl border border-white/8 bg-neutral-900/30 p-5">
                <h2 className="text-sm font-medium text-neutral-300 mb-4">
                  1. Upload your image
                </h2>
                <Dropzone
                  onFileSelected={handleFileSelected}
                  onClear={handleClear}
                  preview={preview}
                  filename={filename}
                  uploading={uploading}
                />
              </div>

              {/* Formats */}
              <div className="rounded-2xl border border-white/8 bg-neutral-900/30 p-5">
                <h2 className="text-sm font-medium text-neutral-300 mb-4">
                  2. Choose output formats
                </h2>
                <FormatSelector selected={formats} onChange={setFormats} />
              </div>
            </div>

            {/* Right: settings + generate */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-neutral-900/30 p-5">
                <h2 className="text-sm font-medium text-neutral-300 mb-4">
                  3. Generation settings
                </h2>
                <GenerationSettingsPanel
                  settings={settings}
                  onChange={setSettings}
                />
              </div>

              {/* Summary + generate */}
              <div className="rounded-2xl border border-white/8 bg-neutral-900/30 p-5 space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">Formats selected</span>
                  <span className="text-neutral-200 font-medium">{formats.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">Variants per format</span>
                  <span className="text-neutral-200 font-medium">{settings.variantCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm border-t border-white/5 pt-3">
                  <span className="text-neutral-400 font-medium">Total outputs</span>
                  <span className="text-white font-bold">{totalOutputs}</span>
                </div>

                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <Button
                  onClick={handleGenerate}
                  loading={uploading}
                  disabled={!file || formats.length === 0}
                  className="w-full"
                  size="lg"
                >
                  <Wand2 className="h-4 w-4" />
                  Generate {totalOutputs} creative{totalOutputs !== 1 ? "s" : ""}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
