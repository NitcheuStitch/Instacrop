// ─────────────────────────────────────────────────────────────────────────────
// Image preprocessor — remove artifact regions before sending to Gemini
// Uses Sharp to blur/neutralise specific pixel regions (watermarks, icons, etc.)
// ─────────────────────────────────────────────────────────────────────────────

import sharp from "sharp";
import type { ArtifactRegion } from "@/types";

/**
 * Apply blur masks over the given artifact regions.
 * Regions are expressed as 0–100 percentage of image dimensions.
 * Returns a cleaned PNG buffer.
 */
export async function removeArtifactRegions(
  imageBuffer: Buffer,
  regions: ArtifactRegion[]
): Promise<Buffer> {
  if (regions.length === 0) return imageBuffer;

  const meta = await sharp(imageBuffer).metadata();
  const imgW = meta.width ?? 1;
  const imgH = meta.height ?? 1;

  const compositeOps: sharp.OverlayOptions[] = [];

  for (const region of regions) {
    const left   = Math.round((region.x / 100) * imgW);
    const top    = Math.round((region.y / 100) * imgH);
    const width  = Math.max(1, Math.round((region.width  / 100) * imgW));
    const height = Math.max(1, Math.round((region.height / 100) * imgH));

    // Clamp to image bounds
    const cl = Math.max(0, Math.min(left, imgW - 2));
    const ct = Math.max(0, Math.min(top,  imgH - 2));
    const cw = Math.min(width,  imgW - cl);
    const ch = Math.min(height, imgH - ct);

    if (cw <= 0 || ch <= 0) continue;

    try {
      // Extract the region and apply heavy blur so the artifact is unreadable
      const blurred = await sharp(imageBuffer)
        .extract({ left: cl, top: ct, width: cw, height: ch })
        .blur(24)
        .toBuffer();

      compositeOps.push({ input: blurred, left: cl, top: ct, blend: "over" });
    } catch {
      // Skip region if extraction fails (e.g. out-of-bounds edge case)
    }
  }

  if (compositeOps.length === 0) return imageBuffer;

  return sharp(imageBuffer)
    .composite(compositeOps)
    .png()
    .toBuffer();
}
