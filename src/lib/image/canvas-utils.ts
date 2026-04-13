// ─────────────────────────────────────────────────────────────────────────────
// Client-side canvas drawing and cropping utilities
// ─────────────────────────────────────────────────────────────────────────────

export interface CanvasSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rectangle selection overlay
// ─────────────────────────────────────────────────────────────────────────────

export function drawRectOverlay(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasW: number,
  canvasH: number,
  sel: CanvasSelection | null
): void {
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.drawImage(img, 0, 0, canvasW, canvasH);

  if (!sel || sel.width < 4 || sel.height < 4) return;

  // Dim 4 surrounding rectangles
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(0, 0, canvasW, sel.y);
  ctx.fillRect(0, sel.y + sel.height, canvasW, canvasH - sel.y - sel.height);
  ctx.fillRect(0, sel.y, sel.x, sel.height);
  ctx.fillRect(sel.x + sel.width, sel.y, canvasW - sel.x - sel.width, sel.height);

  // Border + corners
  ctx.strokeStyle = "#6366f1";
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.strokeRect(sel.x + 1, sel.y + 1, sel.width - 2, sel.height - 2);

  const hs = 8;
  ctx.fillStyle = "#6366f1";
  for (const [hx, hy] of [
    [sel.x, sel.y],
    [sel.x + sel.width - hs, sel.y],
    [sel.x, sel.y + sel.height - hs],
    [sel.x + sel.width - hs, sel.y + sel.height - hs],
  ]) {
    ctx.fillRect(hx, hy, hs, hs);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lasso (freehand) overlay
// ─────────────────────────────────────────────────────────────────────────────

export function drawLassoOverlay(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasW: number,
  canvasH: number,
  points: Point[],
  isComplete: boolean
): void {
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.drawImage(img, 0, 0, canvasW, canvasH);

  if (points.length < 2) return;

  // If the path is closed, dim everything outside using evenodd clip
  if (isComplete && points.length >= 3) {
    ctx.save();
    ctx.beginPath();
    // Outer rectangle (clockwise)
    ctx.rect(0, 0, canvasW, canvasH);
    // Lasso path — evenodd means this interior is NOT filled
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.clip("evenodd");
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.restore();
  }

  // Draw the lasso path itself
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  if (isComplete) ctx.closePath();

  ctx.strokeStyle = "#6366f1";
  ctx.lineWidth = 2;
  ctx.setLineDash(isComplete ? [] : [5, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Closing indicator dot when near start
  if (!isComplete && points.length > 5) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#6366f1";
    ctx.fill();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Get bounding box of a lasso path
// ─────────────────────────────────────────────────────────────────────────────

export function getLassoBounds(points: Point[]): CanvasSelection {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Crop image to a rectangular selection
// ─────────────────────────────────────────────────────────────────────────────

export function cropImageToFile(
  img: HTMLImageElement,
  canvasSel: CanvasSelection,
  scaleX: number,
  scaleY: number,
  filename: string
): Promise<File> {
  return new Promise((resolve, reject) => {
    const srcX = Math.round(canvasSel.x * scaleX);
    const srcY = Math.round(canvasSel.y * scaleY);
    const srcW = Math.round(canvasSel.width * scaleX);
    const srcH = Math.round(canvasSel.height * scaleY);

    if (srcW <= 0 || srcH <= 0) {
      reject(new Error("Selection area is too small"));
      return;
    }

    const off = document.createElement("canvas");
    off.width  = srcW;
    off.height = srcH;
    const ctx = off.getContext("2d");
    if (!ctx) { reject(new Error("No canvas context")); return; }

    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
    off.toBlob(
      (blob) => {
        if (!blob) { reject(new Error("toBlob returned null")); return; }
        resolve(new File([blob], filename, { type: "image/png" }));
      },
      "image/png",
      1.0
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Crop image to the bounding box of a lasso path
// Points are in canvas coordinates; scaleX/Y map to natural image coordinates.
// ─────────────────────────────────────────────────────────────────────────────

export function cropLassoToFile(
  img: HTMLImageElement,
  points: Point[],
  scaleX: number,
  scaleY: number,
  filename: string
): Promise<File> {
  return new Promise((resolve, reject) => {
    const bounds = getLassoBounds(points);
    const srcX = Math.round(bounds.x * scaleX);
    const srcY = Math.round(bounds.y * scaleY);
    const srcW = Math.round(bounds.width * scaleX);
    const srcH = Math.round(bounds.height * scaleY);

    if (srcW <= 0 || srcH <= 0) {
      reject(new Error("Selection area is too small"));
      return;
    }

    const off = document.createElement("canvas");
    off.width  = srcW;
    off.height = srcH;
    const ctx = off.getContext("2d");
    if (!ctx) { reject(new Error("No canvas context")); return; }

    // Scale lasso points to the offscreen canvas (relative to bounding box origin)
    const scaledPoints = points.map((p) => ({
      x: (p.x - bounds.x) * scaleX,
      y: (p.y - bounds.y) * scaleY,
    }));

    // Clip to the lasso shape so only the interior is visible
    ctx.beginPath();
    ctx.moveTo(scaledPoints[0].x, scaledPoints[0].y);
    for (const p of scaledPoints.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.clip();

    // Draw the source image offset to align with bounding box
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

    off.toBlob(
      (blob) => {
        if (!blob) { reject(new Error("toBlob returned null")); return; }
        resolve(new File([blob], filename, { type: "image/png" }));
      },
      "image/png",
      1.0
    );
  });
}
