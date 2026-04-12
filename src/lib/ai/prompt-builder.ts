import type { GenerationMode, BackgroundStyle, OutputFormat, PromptContext } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builder — converts user selections into structured Gemini prompts
// ─────────────────────────────────────────────────────────────────────────────

const BACKGROUND_STYLE_DESCRIPTIONS: Record<BackgroundStyle, string> = {
  studio: "clean minimal studio backdrop, neutral tones, professional product photography lighting",
  lifestyle: "authentic lifestyle setting that naturally complements the product, warm and inviting",
  premium: "luxury premium background, elegant color palette, high-end brand aesthetic",
  vibrant: "bold vibrant colors, high contrast, eye-catching, conversion-focused ad energy",
  minimal: "ultra-minimal white or near-white background, maximum focus on product",
};

const MODE_INSTRUCTIONS: Record<GenerationMode, string> = {
  smart_crop: "Intelligently crop and reframe the source image to fit the target dimensions perfectly. Preserve the focal point and visual hierarchy. Use content-aware fill if edges need extending.",
  background_expand: "Keep the original product intact and expand the background outward to fill the new canvas size. Generate a seamless continuation of the existing environment.",
  recompose: "Preserve the core concept and product, but redesign the layout and composition to best suit the target aspect ratio. The product remains the hero.",
  product_in_scene: "Place the product as the clear hero in a completely new, contextually appropriate scene. Generate a photorealistic environment that complements the product type and use-case.",
};

const VARIANT_STYLES: Record<string, string> = {
  "Studio Clean": "Clean studio shot, pure product focus, minimal distractions, professional e-commerce look",
  "Lifestyle": "Authentic lifestyle context, real-world usage setting, relatable and human",
  "Premium": "Premium elevated aesthetic, luxury feel, refined color palette, high-end brand positioning",
  "Vibrant": "Bold energetic visuals, vibrant colors, high contrast, maximum visual impact for conversion",
};

export function buildPrompt(ctx: PromptContext): string {
  const {
    outputFormat,
    mode,
    backgroundStyle,
    variantName,
    adMood,
    preserveComposition,
    hasIsolatedProduct,
  } = ctx;

  const dimensionGuide = getDimensionCompositionGuide(outputFormat);
  const modeInstruction = MODE_INSTRUCTIONS[mode];
  const bgDescription = BACKGROUND_STYLE_DESCRIPTIONS[backgroundStyle];
  const variantDescription = VARIANT_STYLES[variantName] ?? variantName;

  const lines: string[] = [
    `You are generating a professional ad creative image at exactly ${outputFormat.width}x${outputFormat.height}px for ${outputFormat.platform}.`,
    "",
    `OUTPUT DIMENSIONS: ${outputFormat.width}x${outputFormat.height} (${outputFormat.aspectRatio} aspect ratio)`,
    `PLATFORM: ${outputFormat.platform}`,
    "",
    `GENERATION MODE: ${modeInstruction}`,
    "",
    `VISUAL STYLE: ${variantDescription}`,
    `BACKGROUND: ${bgDescription}`,
  ];

  if (adMood) {
    lines.push(`AD MOOD: ${adMood}`);
  }

  if (hasIsolatedProduct) {
    lines.push(
      "",
      "PRODUCT: The product has been isolated from its original background. Use it as a clean cutout hero element. Integrate it naturally into the new scene."
    );
  }

  if (preserveComposition) {
    lines.push(
      "",
      "COMPOSITION: Preserve the original framing intent. Adapt layout to the new size without reinventing the composition."
    );
  }

  lines.push(
    "",
    `COMPOSITION GUIDANCE FOR ${outputFormat.aspectRatio}: ${dimensionGuide}`,
    "",
    "QUALITY REQUIREMENTS:",
    "- Photorealistic, commercially usable output",
    "- Product must be the clear visual hero",
    "- No distorted, stretched, or warped product elements",
    "- No visible text artifacts or placeholder text",
    "- Sharp edges and clean product rendering",
    "- Suitable for digital advertising use",
    "- No watermarks or branding artifacts",
    "",
    "Output a single high-quality advertising creative image that a brand could immediately use for their campaign."
  );

  return lines.join("\n");
}

function getDimensionCompositionGuide(format: OutputFormat): string {
  const ratio = format.width / format.height;

  if (ratio === 1) {
    return "Square format: balanced central composition, product centered or slightly above center, equal visual weight on all sides.";
  } else if (ratio < 1) {
    return "Portrait format: vertical composition, product placed in the upper two-thirds, negative space below for potential text overlay.";
  } else if (ratio > 1.5) {
    return "Wide landscape format: horizontal composition, product off-center to one side, complementary background filling the other side.";
  } else {
    return "Near-square format: slightly vertical composition, product well-centered with breathing room on all sides.";
  }
}

export function getVariantNames(count: number): string[] {
  const all = Object.keys(VARIANT_STYLES);
  return all.slice(0, Math.min(count, all.length));
}
