import type { OutputFormat, PromptContext } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builder — fallback used when AdAnalysis is unavailable.
// Primary prompt path is buildAdPrompt() in gemini-provider.ts.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Main prompt builder (fallback — no analysis data available)
// ─────────────────────────────────────────────────────────────────────────────

export function buildPrompt(ctx: PromptContext): string {
  const { outputFormat, useProductCutout, strictMode } = ctx;

  const dimensionGuide = getDimensionGuide(outputFormat);

  const productSourceNote = useProductCutout
    ? "SOURCE: An isolated product cutout is provided. Fit it into the new format — preserve all its visual properties exactly."
    : "SOURCE: A full image is provided. Recompose this exact image — do not replace or reimagine it.";

  const lines: string[] = [
    "You are recomposing an existing image into a new aspect ratio.",
    "This is NOT creative generation. This is constrained recomposition.",
    "",
    productSourceNote,
    "",
    "════════════════════════════════════════",
    "TARGET FORMAT",
    "════════════════════════════════════════",
    `Canvas: ${outputFormat.width}×${outputFormat.height}px — ${outputFormat.platform} (${outputFormat.aspectRatio})`,
    `Layout guide: ${dimensionGuide}`,
    "",
    "════════════════════════════════════════",
    "THIS IS THE SAME IMAGE — NOT A NEW ONE",
    "════════════════════════════════════════",
    "Preserve the original visual identity exactly. Only the framing changes.",
    "",
    "Preserve unchanged:",
    "- All subjects, people, products, and objects",
    "- All text, logos, and branding exactly as they appear",
    "- The existing lighting and colour palette",
    "- The existing background style and atmosphere",
    "- The overall composition and visual structure",
    "",
    "════════════════════════════════════════",
    "TEXT & LOGO PRESERVATION — HIGHEST PRIORITY",
    "════════════════════════════════════════",
    "Reproduce all visible text, logos, and labels CHARACTER-FOR-CHARACTER.",
    "Same spelling. Same capitalisation. Same layout. Same visual weight.",
    "Do NOT alter, distort, blur, or overlay any text on any surface.",
    "Do NOT add text that was not in the original image.",
    "",
    "════════════════════════════════════════",
    "YOU MAY",
    "════════════════════════════════════════",
    "- Reframe and crop to fill the new canvas dimensions",
    "- Slightly reposition elements so nothing important is cut off",
    "- Extend the background edges using the same colours and style as the original",
    "- Adjust spacing and padding to suit the new aspect ratio",
    "- Rebalance element placement within the new format",
    "",
    "════════════════════════════════════════",
    "YOU MAY NOT",
    "════════════════════════════════════════",
    "- Create a new scene or replace the background",
    "- Invent objects, people, or elements not present in the original",
    "- Change the lighting style or colour palette",
    "- Add decorative effects, smoke, fire, or fantasy elements",
    "- Redesign or restructure the layout",
    "- Change the theme, mood, or visual identity",
    "- Add watermarks, icons, platform logos, or UI elements",
    "- Add any text not present in the original image",
    "- Alter, distort, or reinterpret any element",
  ];

  if (strictMode) {
    lines.push(
      "",
      "⚠ STRICT MODE — previous attempt introduced unwanted elements. Zero tolerance this retry:",
      "- Zero icons, watermarks, or platform logos anywhere",
      "- Zero text that was not in the original image",
      "- Zero invented background elements",
      "- Reproduce the original image content faithfully. If in doubt, keep it identical."
    );
  }

  lines.push(
    "",
    "════════════════════════════════════════",
    "RESULT",
    "════════════════════════════════════════",
    "A clean, properly formatted version of the original image.",
    "Same content. Same identity. Same style. New format only."
  );

  return lines.join("\n");
}

function getDimensionGuide(format: OutputFormat): string {
  const ratio = format.width / format.height;
  if (ratio === 1)  return "Square canvas — centre all elements, equal visual weight on all sides.";
  if (ratio < 0.7)  return "Tall portrait — stack elements vertically, preserve top and bottom content.";
  if (ratio < 1)    return "Portrait — slight vertical emphasis, ensure nothing important is cropped at top or bottom.";
  if (ratio > 1.7)  return "Wide banner — elements spread horizontally, preserve left and right content.";
  return "Landscape — horizontal breathing room, ensure nothing important is cropped on the sides.";
}

const VARIANT_NAMES = ["Variant A", "Variant B", "Variant C", "Variant D"];

export function getVariantNames(count: number): string[] {
  return VARIANT_NAMES.slice(0, Math.min(count, VARIANT_NAMES.length));
}
