"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  drawRectOverlay,
  drawLassoOverlay,
  cropImageToFile,
  cropLassoToFile,
  getLassoBounds,
  type CanvasSelection,
  type Point,
} from "@/lib/image/canvas-utils";
import { Button } from "@/components/ui/button";
import { RotateCcw, Check, SkipForward, Square, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";

type DrawMode = "rect" | "lasso";

interface ProductSelectorProps {
  imageFile: File;
  imagePreviewUrl: string;
  onConfirm: (cutoutFile: File, preview: string) => void;
  onSkip: () => void;
}

const MAX_CANVAS_WIDTH = 680;
const MIN_LASSO_DIST   = 4; // px — minimum distance before recording a new lasso point

export function ProductSelector({
  imageFile,
  imagePreviewUrl,
  onConfirm,
  onSkip,
}: ProductSelectorProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const imgRef     = useRef<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: MAX_CANVAS_WIDTH, h: 400 });
  const [scale, setScale]           = useState({ x: 1, y: 1 });

  const [mode, setMode] = useState<DrawMode>("lasso");

  // Rectangle state
  const drawingRef  = useRef(false);
  const startRef    = useRef({ x: 0, y: 0 });
  const rectRef     = useRef<CanvasSelection | null>(null);
  const [rectSel, setRectSel] = useState<CanvasSelection | null>(null);

  // Lasso state
  const lassoRef      = useRef<Point[]>([]);
  const lassoDrawing  = useRef(false);
  const [lassoPoints, setLassoPoints] = useState<Point[]>([]);
  const [lassoComplete, setLassoComplete] = useState(false);

  // Shared
  const [cutoutPreview, setCutoutPreview] = useState<string | null>(null);
  const [cropping, setCropping]           = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  // ── Load image ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const img    = new Image();
    img.onload   = () => {
      imgRef.current = img;
      const ratio  = img.naturalHeight / img.naturalWidth;
      const w      = Math.min(MAX_CANVAS_WIDTH, img.naturalWidth);
      const h      = Math.round(w * ratio);
      setCanvasSize({ w, h });
      setScale({ x: img.naturalWidth / w, y: img.naturalHeight / h });
    };
    img.src = imagePreviewUrl;
  }, [imagePreviewUrl]);

  // ── Redraw ──────────────────────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;
    const ctx    = canvas.getContext("2d");
    if (!ctx) return;

    if (mode === "rect") {
      drawRectOverlay(ctx, img, canvasSize.w, canvasSize.h, rectRef.current);
    } else {
      drawLassoOverlay(ctx, img, canvasSize.w, canvasSize.h, lassoRef.current, lassoComplete);
    }
  }, [mode, canvasSize, lassoComplete]);

  useEffect(() => { redraw(); }, [canvasSize, redraw, rectSel, lassoPoints, lassoComplete]);

  // ── Coordinate helper ───────────────────────────────────────────────────────
  function getPos(e: React.MouseEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const sx     = canvas.width / rect.width;
    const sy     = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top)  * sy,
    };
  }

  // ── Rect handlers ───────────────────────────────────────────────────────────
  function rectDown(e: React.MouseEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    startRef.current   = getPos(e);
    setCutoutPreview(null);
    setError(null);
    rectRef.current = null;
    setRectSel(null);
  }

  function rectMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const pos = getPos(e);
    rectRef.current = {
      x: Math.min(startRef.current.x, pos.x),
      y: Math.min(startRef.current.y, pos.y),
      width:  Math.abs(pos.x - startRef.current.x),
      height: Math.abs(pos.y - startRef.current.y),
    };
    redraw();
  }

  function rectUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const pos = getPos(e);
    const sel: CanvasSelection = {
      x: Math.min(startRef.current.x, pos.x),
      y: Math.min(startRef.current.y, pos.y),
      width:  Math.abs(pos.x - startRef.current.x),
      height: Math.abs(pos.y - startRef.current.y),
    };
    if (sel.width > 10 && sel.height > 10) {
      rectRef.current = sel;
      setRectSel(sel);
    } else {
      rectRef.current = null;
      setRectSel(null);
    }
    redraw();
  }

  // ── Lasso handlers ──────────────────────────────────────────────────────────
  function lassoDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos          = getPos(e);
    lassoRef.current   = [pos];
    lassoDrawing.current = true;
    setLassoPoints([pos]);
    setLassoComplete(false);
    setCutoutPreview(null);
    setError(null);
    redraw();
  }

  function lassoMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!lassoDrawing.current) return;
    const pos  = getPos(e);
    const last = lassoRef.current[lassoRef.current.length - 1];
    const dx   = pos.x - last.x;
    const dy   = pos.y - last.y;
    if (Math.sqrt(dx * dx + dy * dy) < MIN_LASSO_DIST) return;
    lassoRef.current = [...lassoRef.current, pos];
    setLassoPoints([...lassoRef.current]);
    redraw();
  }

  function lassoUp() {
    if (!lassoDrawing.current) return;
    lassoDrawing.current = false;
    if (lassoRef.current.length >= 6) {
      setLassoComplete(true);
      redraw();
    } else {
      // Too few points — reset
      lassoRef.current = [];
      setLassoPoints([]);
    }
  }

  // ── Unified handlers ────────────────────────────────────────────────────────
  const handleMouseDown = mode === "rect" ? rectDown : lassoDown;
  const handleMouseMove = mode === "rect" ? rectMove : lassoMove;
  const handleMouseUp   = mode === "rect" ? rectUp   : lassoUp;

  // ── Reset ───────────────────────────────────────────────────────────────────
  function handleReset() {
    rectRef.current  = null;
    lassoRef.current = [];
    setRectSel(null);
    setLassoPoints([]);
    setLassoComplete(false);
    setCutoutPreview(null);
    setError(null);
    redraw();
  }

  // ── Confirm / crop ──────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!imgRef.current) return;
    setCropping(true);
    setError(null);
    try {
      const baseName = imageFile.name.replace(/\.[^.]+$/, "");
      let file: File;

      if (mode === "rect" && rectRef.current) {
        file = await cropImageToFile(
          imgRef.current,
          rectRef.current,
          scale.x,
          scale.y,
          `cutout_${baseName}.png`
        );
      } else if (mode === "lasso" && lassoRef.current.length >= 3) {
        file = await cropLassoToFile(
          imgRef.current,
          lassoRef.current,
          scale.x,
          scale.y,
          `cutout_${baseName}.png`
        );
      } else {
        throw new Error("No valid selection to confirm");
      }

      const url = URL.createObjectURL(file);
      setCutoutPreview(url);
      onConfirm(file, url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Crop failed");
    } finally {
      setCropping(false);
    }
  }

  // ── Derived state ───────────────────────────────────────────────────────────
  const hasSelection =
    (mode === "rect" && !!rectSel && rectSel.width > 10 && rectSel.height > 10) ||
    (mode === "lasso" && lassoComplete && lassoPoints.length >= 6);

  const selectionSizeLabel = (() => {
    if (mode === "rect" && rectSel) {
      return `${Math.round(rectSel.width * scale.x)} × ${Math.round(rectSel.height * scale.y)}px`;
    }
    if (mode === "lasso" && lassoPoints.length > 0) {
      const b = getLassoBounds(lassoPoints);
      return `${Math.round(b.width * scale.x)} × ${Math.round(b.height * scale.y)}px`;
    }
    return null;
  })();

  return (
    <div className="space-y-4">
      {/* Mode toggle + reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-800 border border-white/5">
          <button
            onClick={() => { setMode("lasso"); handleReset(); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              mode === "lasso"
                ? "bg-brand-600 text-white"
                : "text-neutral-400 hover:text-white"
            )}
          >
            <PenLine className="h-3.5 w-3.5" />
            Free draw
          </button>
          <button
            onClick={() => { setMode("rect"); handleReset(); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              mode === "rect"
                ? "bg-brand-600 text-white"
                : "text-neutral-400 hover:text-white"
            )}
          >
            <Square className="h-3.5 w-3.5" />
            Rectangle
          </button>
        </div>

        <Button variant="ghost" size="sm" onClick={handleReset}>
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      {/* Instruction */}
      <p className="text-xs text-neutral-500">
        {mode === "lasso"
          ? "Click and drag to draw freely around your product. Release to complete."
          : "Click and drag to draw a rectangle around your product."}
      </p>

      {/* Canvas */}
      <div
        className="relative rounded-xl overflow-hidden border border-white/10 bg-neutral-900"
        style={{ cursor: "crosshair" }}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          className="w-full block select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {!hasSelection && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 text-neutral-300 text-xs">
              {mode === "lasso" ? (
                <><PenLine className="h-3.5 w-3.5" /> Draw around your product</>
              ) : (
                <><Square className="h-3.5 w-3.5" /> Draw a box around your product</>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selection info */}
      {hasSelection && selectionSizeLabel && (
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <div className="h-2 w-2 rounded-full bg-brand-500" />
          Selection area: {selectionSizeLabel}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Cutout preview */}
      {cutoutPreview && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cutoutPreview}
            alt="Product cutout"
            className="h-14 w-14 object-contain rounded-lg border border-white/10 bg-neutral-800"
          />
          <div>
            <p className="text-sm font-medium text-emerald-400">Product selected</p>
            <p className="text-xs text-neutral-500 mt-0.5">
              This area will be used as your product hero in all generated creatives.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleConfirm}
          disabled={!hasSelection || cropping}
          loading={cropping}
          size="md"
        >
          <Check className="h-4 w-4" />
          Use this selection
        </Button>
        <Button variant="ghost" size="md" onClick={onSkip}>
          <SkipForward className="h-4 w-4" />
          Skip — use full image
        </Button>
      </div>
    </div>
  );
}
