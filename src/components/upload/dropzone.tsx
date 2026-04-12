"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import Image from "next/image";
import { Upload, X, ImageIcon } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";

interface DropzoneProps {
  onFileSelected: (file: File, previewUrl: string) => void;
  onClear: () => void;
  preview: string | null;
  filename: string | null;
  uploading?: boolean;
}

export function Dropzone({
  onFileSelected,
  onClear,
  preview,
  filename,
  uploading = false,
}: DropzoneProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setError(null);
      const file = acceptedFiles[0];
      if (!file) return;

      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setError("File is too large. Max 10MB.");
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      onFileSelected(file, previewUrl);
    },
    [onFileSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    multiple: false,
    disabled: uploading,
  });

  if (preview) {
    return (
      <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-neutral-900">
        <div className="aspect-square relative max-h-72 w-full">
          <Image
            src={preview}
            alt={filename ?? "Uploaded image"}
            fill
            className="object-contain"
          />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
          <div className="flex items-center gap-2 min-w-0">
            <ImageIcon className="h-4 w-4 text-neutral-400 shrink-0" />
            <span className="text-sm text-neutral-300 truncate">{filename}</span>
          </div>
          <button
            onClick={onClear}
            className="ml-2 p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          "relative rounded-2xl border-2 border-dashed transition-all duration-150 cursor-pointer",
          "flex flex-col items-center justify-center gap-3 p-10 text-center min-h-[220px]",
          isDragActive
            ? "border-brand-500 bg-brand-500/5"
            : "border-neutral-700 bg-neutral-900/50 hover:border-neutral-500 hover:bg-neutral-900",
          uploading && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <div className="h-12 w-12 rounded-xl bg-neutral-800 flex items-center justify-center">
          <Upload className="h-6 w-6 text-neutral-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-200">
            {isDragActive ? "Drop it here" : "Drop your image here"}
          </p>
          <p className="text-xs text-neutral-500 mt-1">or click to browse</p>
        </div>
        <p className="text-xs text-neutral-600">PNG, JPG, WEBP up to 10MB</p>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
