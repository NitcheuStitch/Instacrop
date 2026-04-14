"use client";

import { useState, useRef } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Upload, Wand2, X, AlertTriangle, Terminal } from "lucide-react";

const DEFAULT_PROMPT =
  "Take this product image and create a professional advertising creative with a clean studio background. Keep the product as the hero, centred, well-lit.";

export default function DevPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [image, setImage]         = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompt, setPrompt]       = useState(DEFAULT_PROMPT);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<{ imageBase64: string; mimeType: string; text: string | null } | null>(null);
  const [error, setError]         = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  }

  function clearImage() {
    setImage(null);
    setImagePreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleRun() {
    if (!image || !prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("image", image);
      fd.append("prompt", prompt);

      const res = await fetch("/api/dev-test", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function downloadResult() {
    if (!result) return;
    const link = document.createElement("a");
    link.href = `data:${result.mimeType};base64,${result.imageBase64}`;
    link.download = `dev-result-${Date.now()}.png`;
    link.click();
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-amber-500/15 border border-amber-500/25">
              <Terminal className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Dev mode</h1>
              <p className="text-neutral-400 text-sm mt-0.5">
                Test prompts directly against the Gemini API
              </p>
            </div>
            <span className="ml-auto text-xs font-mono px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400">
              DEV
            </span>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── Left column: Input ─────────────────────────────────────── */}
            <div className="space-y-4">

              {/* Image upload */}
              <div className="rounded-2xl border border-white/8 bg-neutral-900/30 p-5">
                <h2 className="text-sm font-medium text-neutral-300 mb-3">Input image</h2>

                {!imagePreview ? (
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/10 rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-brand-500/50 hover:bg-brand-500/5 transition-colors"
                  >
                    <Upload className="h-8 w-8 text-neutral-500" />
                    <div className="text-center">
                      <p className="text-sm text-neutral-400">Drop an image or click to browse</p>
                      <p className="text-xs text-neutral-600 mt-1">PNG, JPG, WEBP</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                ) : (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Input"
                      className="w-full rounded-xl border border-white/8 object-contain max-h-64 bg-neutral-800"
                    />
                    <button
                      onClick={clearImage}
                      className="absolute top-2 right-2 h-7 w-7 rounded-full bg-neutral-900/80 border border-white/10 flex items-center justify-center hover:bg-red-500/20 hover:border-red-500/40 transition-colors"
                    >
                      <X className="h-3.5 w-3.5 text-neutral-400" />
                    </button>
                    <p className="text-xs text-neutral-500 mt-2 truncate">{image?.name}</p>
                  </div>
                )}
              </div>

              {/* Prompt */}
              <div className="rounded-2xl border border-white/8 bg-neutral-900/30 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-neutral-300">Custom prompt</h2>
                  <button
                    onClick={() => setPrompt(DEFAULT_PROMPT)}
                    className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    Reset to default
                  </button>
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={8}
                  placeholder="Enter your prompt here..."
                  className={cn(
                    "w-full resize-none rounded-xl bg-neutral-800/60 border border-white/8 px-4 py-3",
                    "text-sm text-neutral-200 placeholder:text-neutral-600",
                    "focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/40",
                    "transition-colors font-mono leading-relaxed"
                  )}
                />
                <p className="text-xs text-neutral-600 mt-2 text-right">
                  {prompt.length} characters
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-sm text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="font-mono text-xs break-all">{error}</span>
                </div>
              )}

              {/* Run button */}
              <Button
                onClick={handleRun}
                disabled={!image || !prompt.trim()}
                loading={loading}
                className="w-full"
                size="lg"
              >
                <Wand2 className="h-4 w-4" />
                {loading ? "Running..." : "Run prompt"}
              </Button>
            </div>

            {/* ── Right column: Output ───────────────────────────────────── */}
            <div className="rounded-2xl border border-white/8 bg-neutral-900/30 p-5 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-neutral-300">Output</h2>
                {result && (
                  <button
                    onClick={downloadResult}
                    className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    Download
                  </button>
                )}
              </div>

              <div className="flex-1 flex items-center justify-center min-h-64">
                {loading && (
                  <div className="flex flex-col items-center gap-3 text-neutral-500">
                    <svg className="h-8 w-8 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="text-sm">Waiting for Gemini...</p>
                  </div>
                )}

                {!loading && !result && (
                  <div className="text-center text-neutral-600">
                    <Wand2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Result will appear here</p>
                  </div>
                )}

                {!loading && result && (
                  <div className="w-full space-y-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:${result.mimeType};base64,${result.imageBase64}`}
                      alt="Generated output"
                      className="w-full rounded-xl border border-white/8 object-contain bg-neutral-800"
                    />
                    {result.text && (
                      <div className="rounded-xl bg-neutral-800/60 border border-white/8 px-4 py-3">
                        <p className="text-xs text-neutral-500 mb-1 font-medium">Model text response</p>
                        <p className="text-xs text-neutral-300 font-mono leading-relaxed whitespace-pre-wrap">
                          {result.text}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
