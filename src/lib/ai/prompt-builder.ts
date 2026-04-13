import type { GenerationMode, BackgroundStyle, OutputFormat, PromptContext, ProductAnalysis } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builder — category-aware, product-hero focused
// ─────────────────────────────────────────────────────────────────────────────

const BACKGROUND_STYLE_DESCRIPTIONS: Record<BackgroundStyle, string> = {
  studio:    "clean minimal studio, neutral gradient backdrop, soft even lighting, professional product photography",
  lifestyle: "authentic lifestyle scene, real-world environment that fits the product naturally, warm and inviting",
  premium:   "luxury high-end setting, elegant muted palette, refined materials, premium brand aesthetic",
  vibrant:   "bold vibrant colours, high contrast, energetic composition, maximum visual impact for conversion",
  minimal:   "ultra-clean white or light grey, pure negative space, absolute focus on the product",
};

const MODE_INSTRUCTIONS: Record<GenerationMode, string> = {
  smart_crop:
    "Reframe the source image to fill the target canvas perfectly. Preserve the product as the focal point. Extend edges with content-aware fill if needed — do not distort the product.",
  background_expand:
    "Keep the product exactly as it is. Seamlessly extend the background outward to fill the new canvas dimensions. Match lighting, colour, and atmosphere of the original scene.",
  recompose:
    "Preserve the product but redesign the layout and composition to best suit the target aspect ratio. Place the product as the clear visual anchor. Regenerate the background and negative space to support the new format.",
  product_in_scene:
    "Place the provided product as the hero element in a completely new, contextually appropriate scene. The scene should feel purpose-built for this product — not generic. Match lighting scale and perspective to the product.",
};

const VARIANT_STYLE_DESCRIPTIONS: Record<string, string> = {
  "Studio Clean": "Minimal studio, pure product focus, clean professional e-commerce look, subtle shadow, neutral backdrop",
  "Lifestyle":    "Real-world authentic context, natural usage environment, human-feeling scene, relatable and warm",
  "Premium":      "Elevated luxury aesthetic, sophisticated tones, premium material textures, high-end brand feel",
  "Vibrant":      "Bold saturated colours, high contrast, punchy energy, visually arresting — designed to stop scroll",
};

// ─────────────────────────────────────────────────────────────────────────────
// Category → suggested scene descriptions
// Used when no product analysis is available as sensible defaults
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_SCENE_HINTS: Record<string, string> = {
  "supplement bottle":  "clean wellness studio, bright white shelving, natural light, green plant accents, health-focused",
  "perfume":            "luxury marble surface, soft bokeh background, golden hour light, premium lifestyle setting",
  "food product":       "warm kitchen counter, natural light from window, fresh ingredients nearby, appetite-inducing styling",
  "beverage":           "ice, condensation on surface, bright studio or outdoor café setting, refreshing mood",
  "skincare":           "clean bathroom shelf, marble textures, soft morning light, calm and pure atmosphere",
  "electronics":        "clean desk setup, dark or light studio, minimal styling, tech-focused environment",
  "clothing":           "minimal wardrobe background or lifestyle setting matching the garment style",
  "moving box":         "home interior, boxes, hallway, doorstep — relocation and home context",
  "fitness equipment":  "gym setting or clean outdoor space, motivational mood, athletic energy",
  "default":            "clean professional studio that complements the product's colour and form",
};

function getSceneHint(analysis: ProductAnalysis | undefined): string {
  if (!analysis) return CATEGORY_SCENE_HINTS["default"];
  // Try exact match, then partial match
  const key = analysis.category.toLowerCase();
  for (const [hint, desc] of Object.entries(CATEGORY_SCENE_HINTS)) {
    if (key.includes(hint) || hint.includes(key)) return desc;
  }
  if (analysis.suggestedScenes.length > 0) return analysis.suggestedScenes.join(", ");
  return CATEGORY_SCENE_HINTS["default"];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main prompt builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildPrompt(ctx: PromptContext): string {
  const { outputFormat, mode, backgroundStyle, variantName, adMood, preserveComposition, useProductCutout, productAnalysis, strictMode } = ctx;

  const modeInstruction    = MODE_INSTRUCTIONS[mode];
  const bgDescription      = BACKGROUND_STYLE_DESCRIPTIONS[backgroundStyle];
  const variantDescription = VARIANT_STYLE_DESCRIPTIONS[variantName] ?? variantName;
  const dimensionGuide     = getDimensionGuide(outputFormat);
  const sceneHint          = getSceneHint(productAnalysis);

  const lines: string[] = [];

  // ── Header ──────────────────────────────────────────────────────────────────
  lines.push(
    `You are creating a professional advertising creative at ${outputFormat.width}×${outputFormat.height}px for ${outputFormat.platform}.`,
    ""
  );

  // ── Product source ───────────────────────────────────────────────────────────
  if (useProductCutout) {
    lines.push(
      "PRODUCT SOURCE: The image provided is an isolated product cutout — the exact product the user wants featured.",
      "CRITICAL: Do NOT treat this as a full scene. This is ONLY the product. Build a new environment around it.",
      "The product must appear in the output exactly as provided — same shape, same label, same proportions. Do not alter, reshape, or replace it.",
      ""
    );
  } else {
    lines.push(
      "PRODUCT SOURCE: The full source image is provided. The product is the primary subject.",
      "Identify and preserve the main product/subject when applying the generation mode.",
      ""
    );
  }

  // ── Product analysis ────────────────────────────────────────────────────────
  if (productAnalysis) {
    lines.push(
      `PRODUCT: ${productAnalysis.category}`,
      `COLOUR TONE: ${productAnalysis.colorTone}`,
      `AD STYLE: ${productAnalysis.adStyle}`,
      `SUGGESTED CONTEXT: ${sceneHint}`,
      ""
    );
  }

  // ── Generation mode ──────────────────────────────────────────────────────────
  lines.push(
    `GENERATION MODE: ${modeInstruction}`,
    ""
  );

  // ── Visual style ─────────────────────────────────────────────────────────────
  lines.push(
    `CREATIVE VARIANT: ${variantDescription}`,
    `BACKGROUND STYLE: ${bgDescription}`,
    `SCENE CONTEXT: ${sceneHint}`,
    ""
  );

  if (adMood) lines.push(`AD MOOD: ${adMood}`, "");

  // ── Composition ──────────────────────────────────────────────────────────────
  lines.push(
    `COMPOSITION FOR ${outputFormat.aspectRatio}: ${dimensionGuide}`
  );

  if (preserveComposition) {
    lines.push("Preserve the original framing intent. Do not reinvent the layout — adapt it gracefully to the new format.");
  }

  lines.push("");

  // ── Hard rules ───────────────────────────────────────────────────────────────
  lines.push(
    "ABSOLUTE REQUIREMENTS — PRODUCT:",
    "- The product is the undisputed visual hero — every element exists to support it",
    "- Do NOT replace, distort, stretch, or warp the product",
    "- Do NOT fill the canvas with a random scene that ignores the product",
    "- Do NOT output a generic stock photo — the product must be clearly present",
    "- Lighting must feel natural and consistent with the chosen scene",
    "",
    "ABSOLUTE REQUIREMENTS — NO UI CONTAMINATION:",
    "- Do NOT add any watermarks, copyright text, or photo attribution",
    "- Do NOT add any social media logos, icons, or platform branding (Instagram, TikTok, Pinterest, etc.)",
    "- Do NOT add any interface elements: buttons, badges, price tags, ratings, shopping icons",
    "- Do NOT add any text overlays, captions, promotional text, or call-to-action labels",
    "- Do NOT replicate any UI elements or logos that may have appeared in the input image",
    "- Do NOT place icons, logos, or symbols in any corner of the canvas",
    "- The output must be a PURE photographic advertising image — zero interface elements",
    "",
    "ABSOLUTE REQUIREMENTS — IMAGE QUALITY:",
    "- Output must be photorealistic and commercially ready",
    "- No AI generation artefacts, blurring, or unnatural edges around the product",
    "- No visible seams, tiling, or repetitive patch patterns",
    "- Clean, sharp product edges that integrate naturally with the scene",
    "",
    "Output a single ad-ready image a brand could immediately publish — no overlays, no logos, no text."
  );

  // ── Strict mode addendum (validation-failure retry) ───────────────────────
  if (strictMode) {
    lines.push(
      "",
      "⚠ STRICT MODE — previous attempt contained artifacts. This retry must be completely clean:",
      "- Zero icons in any corner of the image",
      "- Zero watermarks anywhere in the image",
      "- Zero social media logos, platform icons, or app symbols",
      "- Zero text of any kind that is not intentional design",
      "- Pure advertising photograph only. If in doubt, leave it out."
    );
  }

  return lines.join("\n");
}

function getDimensionGuide(format: OutputFormat): string {
  const ratio = format.width / format.height;
  if (ratio === 1)    return "Square: centred composition, equal visual weight, product centred or slightly above midpoint.";
  if (ratio < 0.7)    return "Tall portrait: vertical flow, product in upper half, space below for ad copy overlay.";
  if (ratio < 1)      return "Portrait: product centred with breathing room, slight vertical emphasis.";
  if (ratio > 1.7)    return "Wide banner: product placed left or right of centre, complementary background on the other side.";
  return "Landscape: product centred with horizontal breathing room, background complements on both sides.";
}

export function getVariantNames(count: number): string[] {
  const all = Object.keys(VARIANT_STYLE_DESCRIPTIONS);
  return all.slice(0, Math.min(count, all.length));
}
