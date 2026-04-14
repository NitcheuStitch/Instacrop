"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Dropzone } from "@/components/editor/dropzone";
import { ProductSelector } from "@/components/editor/product-selector";
import { FormatSelector } from "@/components/generation/format-selector";
import { Button } from "@/components/ui/button";
import type { ArtifactRegion, GenerationSettings, OutputFormat } from "@/types";
import { FORMAT_PRESETS } from "@/lib/formats";
import { ArrowRight, ArrowLeft, Wand2, ImageIcon, Crop, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "upload" | "select" | "configure";

const DEFAULT_SETTINGS: Omit<GenerationSettings, "formats" | "useProductCutout" | "productCutoutUrl"> = {
  mode: "product_in_scene",
  backgroundStyle: "studio",
  variantCount: 2,
  isolateProduct: false,
  useOriginalBackground: false,
  preserveComposition: false,
};

const STEPS: { id: Step; label: string; description: string }[] = [
  { id: "upload",    label: "Upload",          description: "Add your product image" },
  { id: "select",    label: "Select product",  description: "Define the product area" },
  { id: "configure", label: "Configure",       description: "Formats and style" },
];

export default function GeneratePage() {
  const router = useRouter();

  const [step, setStep]       = useState<Step>("upload");
  const [file, setFile]       = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  // After original upload
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadingOriginal, setUploadingOriginal] = useState(false);

  // After product selection
  const [cutoutFile, setCutoutFile]     = useState<File | null>(null);
  const [cutoutPreview, setCutoutPreview] = useState<string | null>(null);
  const [useFullImage, setUseFullImage] = useState(false);

  // Artifact scan
  type ScanState = "idle" | "scanning" | "done" | "error";
  const [scanState, setScanState]           = useState<ScanState>("idle");
  const [artifactRegions, setArtifactRegions] = useState<ArtifactRegion[]>([]);

  const [formats, setFormats]   = useState<OutputFormat[]>([FORMAT_PRESETS[0]]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [generating, setGenerating] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // ─── Artifact scan ─────────────────────────────────────────────────────────
  // Automatically run when the user enters step 2 with an uploaded image URL.

  useEffect(() => {
    if (step !== "select" || !uploadedImageUrl) return;
    let cancelled = false;

    async function runScan() {
      setScanState("scanning");
      setArtifactRegions([]);
      try {
        const res = await fetch("/api/preprocess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: uploadedImageUrl }),
        });
        if (cancelled) return;
        if (!res.ok) throw new Error("Scan request failed");
        const { regions } = await res.json() as { regions: ArtifactRegion[] };
        if (cancelled) return;
        setArtifactRegions(regions ?? []);
        setScanState("done");
      } catch {
        if (cancelled) return;
        setScanState("error");
      }
    }

    runScan();
    return () => { cancelled = true; };
  }, [step, uploadedImageUrl]);

  // ─── Step 1 handlers ───────────────────────────────────────────────────────

  function handleFileSelected(f: File, previewUrl: string) {
    setFile(f);
    setPreview(previewUrl);
    setFilename(f.name);
    setError(null);
    // Reset downstream state when a new file is chosen
    setCutoutFile(null);
    setCutoutPreview(null);
    setUseFullImage(false);
    setUploadedImageUrl(null);
  }

  function handleClear() {
    setFile(null);
    setPreview(null);
    setFilename(null);
    setCutoutFile(null);
    setCutoutPreview(null);
    setUseFullImage(false);
    setUploadedImageUrl(null);
  }

  async function handleUploadAndNext() {
    if (!file) return;
    setUploadingOriginal(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg ?? "Upload failed");
      }
      const { url } = await res.json();
      setUploadedImageUrl(url);
      setStep("select");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingOriginal(false);
    }
  }

  // ─── Step 2 handlers ───────────────────────────────────────────────────────

  function handleSelectionConfirmed(f: File, previewUrl: string) {
    setCutoutFile(f);
    setCutoutPreview(previewUrl);
    setUseFullImage(false);
  }

  function handleSkipSelection() {
    setCutoutFile(null);
    setCutoutPreview(null);
    setUseFullImage(true);
    setStep("configure");
  }

  function handleProceedWithSelection() {
    if (!cutoutFile) return;
    setStep("configure");
  }

  // ─── Step 3: Generate ──────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!uploadedImageUrl) return;
    if (formats.length === 0) {
      setError("Please select at least one output format.");
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      let productCutoutUrl: string | undefined;

      // Upload the cutout if the user made a selection
      if (cutoutFile && !useFullImage) {
        const fd = new FormData();
        fd.append("file", cutoutFile);
        fd.append("originalFilename", filename ?? "product");
        const cutoutRes = await fetch("/api/upload-cutout", { method: "POST", body: fd });
        if (!cutoutRes.ok) {
          const { error: msg } = await cutoutRes.json();
          throw new Error(msg ?? "Cutout upload failed");
        }
        const { url } = await cutoutRes.json();
        productCutoutUrl = url;
      }

      const useProductCutout = !!productCutoutUrl;

      // Create job
      const jobRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalImageUrl: uploadedImageUrl,
          originalFilename: filename ?? "image",
          settings: {
            ...settings,
            formats,
            useProductCutout,
            productCutoutUrl,
          },
        }),
      });
      if (!jobRes.ok) {
        const { error: msg } = await jobRes.json();
        throw new Error(msg ?? "Failed to create job");
      }
      const { jobId } = await jobRes.json();

      // Start generation
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!genRes.ok) throw new Error("Failed to start generation");

      router.push(`/results/${jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="min-h-screen bg-neutral-950">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">New generation</h1>
            <p className="text-neutral-400 text-sm mt-1">
              Upload one product image and get multiple ad creatives.
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-0 mb-8">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                      i < currentStepIndex
                        ? "bg-brand-600 text-white"
                        : i === currentStepIndex
                        ? "bg-brand-500 text-white ring-2 ring-brand-500/30"
                        : "bg-neutral-800 text-neutral-500"
                    )}
                  >
                    {i < currentStepIndex ? "✓" : i + 1}
                  </div>
                  <div className="hidden sm:block">
                    <p className={cn(
                      "text-xs font-medium",
                      i === currentStepIndex ? "text-white" : "text-neutral-500"
                    )}>
                      {s.label}
                    </p>
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn(
                    "h-px flex-1 mx-3 transition-colors",
                    i < currentStepIndex ? "bg-brand-600" : "bg-neutral-800"
                  )} />
                )}
              </div>
            ))}
          </div>

          {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
          {step === "upload" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/8 bg-neutral-900/30 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ImageIcon className="h-4 w-4 text-brand-400" />
                  <h2 className="text-sm font-medium text-neutral-200">Upload your product image</h2>
                </div>
                <Dropzone
                  onFileSelected={handleFileSelected}
                  onClear={handleClear}
                  preview={preview}
                  filename={filename}
                  uploading={uploadingOriginal}
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                  {error}
                </p>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={handleUploadAndNext}
                  disabled={!file}
                  loading={uploadingOriginal}
                  size="lg"
                >
                  Next: Select product
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 2: Select product ─────────────────────────────────────── */}
          {step === "select" && file && preview && (
            <div className="space-y-6">
              {/* Artifact scan status */}
              {scanState === "scanning" && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-white/8 bg-neutral-900/50 text-xs text-neutral-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  Scanning for watermarks and UI overlays…
                </div>
              )}
              {scanState === "done" && artifactRegions.length === 0 && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  No artifacts detected — image is clean
                </div>
              )}
              {scanState === "done" && artifactRegions.length > 0 && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">
                      {artifactRegions.length} artifact{artifactRegions.length !== 1 ? "s" : ""} detected
                    </span>
                    <span className="text-amber-500/70 ml-1">
                      ({artifactRegions.map((r) => r.type).join(", ")})
                    </span>
                    <span className="block text-amber-500/70 mt-0.5">
                      These will be automatically cleaned before generation.
                    </span>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-white/8 bg-neutral-900/30 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Crop className="h-4 w-4 text-brand-400" />
                  <h2 className="text-sm font-medium text-neutral-200">Select the product</h2>
                </div>
                <ProductSelector
                  imageFile={file}
                  imagePreviewUrl={preview}
                  onConfirm={handleSelectionConfirmed}
                  onSkip={handleSkipSelection}
                />
              </div>

              {cutoutFile && (
                <div className="flex items-center justify-between gap-4">
                  <button
                    onClick={() => setStep("upload")}
                    className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                  <Button onClick={handleProceedWithSelection} size="lg">
                    Continue with selection
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {!cutoutFile && (
                <button
                  onClick={() => setStep("upload")}
                  className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
              )}
            </div>
          )}

          {/* ── Step 3: Configure + Generate ──────────────────────────────── */}
          {step === "configure" && (
            <div className="space-y-6">
              {/* Selection summary */}
              <div className="flex items-center gap-3 p-4 rounded-xl border border-white/8 bg-neutral-900/30">
                {cutoutPreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cutoutPreview}
                      alt="Selected product"
                      className="h-14 w-14 rounded-lg border border-white/10 bg-neutral-800 object-contain shrink-0"
                    />
                    <div>
                      <p className="text-sm font-medium text-white">Product selection active</p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Generation will use your selected cutout as the product hero.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview ?? ""}
                      alt="Source image"
                      className="h-14 w-14 rounded-lg border border-white/10 bg-neutral-800 object-contain shrink-0"
                    />
                    <div>
                      <p className="text-sm font-medium text-white">Using full image</p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        No product selection made. The full uploaded image will be used.
                      </p>
                    </div>
                  </>
                )}
                <button
                  onClick={() => setStep("select")}
                  className="ml-auto text-xs text-brand-400 hover:text-brand-300 transition-colors shrink-0"
                >
                  Edit selection
                </button>
              </div>

              {/* Formats */}
              <div className="rounded-2xl border border-white/8 bg-neutral-900/30 p-5">
                <h2 className="text-sm font-medium text-neutral-300 mb-4">Output formats</h2>
                <FormatSelector selected={formats} onChange={setFormats} />
              </div>

              {/* Summary + generate */}
              <div className="rounded-2xl border border-white/8 bg-neutral-900/30 p-5 space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">Source</span>
                  <span className="text-neutral-200 font-medium">
                    {cutoutPreview ? "Product cutout" : "Full image"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm border-t border-white/5 pt-3">
                  <span className="text-neutral-400 font-medium">Formats selected</span>
                  <span className="text-white font-bold">{formats.length}</span>
                </div>

                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setStep("select")}
                    className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                  <Button
                    onClick={handleGenerate}
                    loading={generating}
                    disabled={formats.length === 0}
                    className="flex-1"
                    size="lg"
                  >
                    <Wand2 className="h-4 w-4" />
                    Generate {formats.length} creative{formats.length !== 1 ? "s" : ""}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
