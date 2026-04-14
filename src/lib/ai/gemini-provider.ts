import { GoogleGenAI } from "@google/genai";
import type { AdAnalysis, ArtifactRegion, GenerativeResult, OutputFormat, ProductAnalysis, PromptContext, TextAnalysis } from "@/types";
import { buildPrompt } from "./prompt-builder";

// ─────────────────────────────────────────────────────────────────────────────
// Models
// ─────────────────────────────────────────────────────────────────────────────

const GENERATION_MODEL = "gemini-3-pro-image-preview"; // upgraded: premium image generation
const TEXT_MODEL       = "gemini-2.0-flash";
const MAX_RETRIES      = 2;
const RETRY_DELAY_MS   = 3000;

// ─────────────────────────────────────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────────────────────────────────────

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 1 — Ad Analysis
// Sends the uploaded image to a text model and returns structured JSON
// describing the product, its text elements, lighting, and what to avoid.
// This JSON drives every downstream prompt — it is the source of truth.
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeAd(
  imageBase64: string,
  mimeType: string
): Promise<AdAnalysis> {
  const client = getClient();

  const prompt = `You are an expert commercial advertising analyst.

Analyse this product image and return a structured JSON object that will be used to generate premium advertising creatives.

Your job is to extract precise information about the product so it stays the DOMINANT SUBJECT in all generated outputs.

Return this exact JSON structure:
{
  "main_subject": "precise description of the main product — include brand name, product type, shape, colour, and any key visual features",
  "secondary_elements": ["list every non-product element visible in the image"],
  "text_elements": ["copy every piece of text visible on the product EXACTLY as written — brand name, slogans, labels, ingredient callouts, logos"],
  "visual_priority": ["ordered list of what must be preserved at all costs, most important first"],
  "composition_type": "describe the current framing (e.g. close-up hero shot, three-quarter view, flat lay, angled top-down)",
  "subject_priority": "explain precisely how the product should dominate the frame in output images",
  "lighting_style": "describe current lighting and the ideal lighting style that would make this product look premium",
  "background_style": "describe the ideal background that supports this product without competing with it",
  "effects_balance": "describe how any dramatic effects (fire, smoke, energy, splash) should support rather than overpower the product",
  "sharpness_goal": "describe exactly what must be tack-sharp in the output — label, edges, logo, texture",
  "avoid": [
    "wide cinematic composition",
    "small product in frame",
    "soft focus on product",
    "haze or fog over product",
    "add any other specific avoidances for THIS product based on what you see"
  ]
}

Return ONLY valid JSON. No markdown. No explanation.`;

  console.log(`[analyzeAd] Stage 1 — model: ${TEXT_MODEL}`);

  try {
    const response = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        { inlineData: { mimeType, data: imageBase64 } },
        { text: prompt },
      ],
    });

    const raw  = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const json = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(json) as AdAnalysis;

    console.log(`[analyzeAd] Analysis result:`, JSON.stringify(parsed, null, 2));
    return parsed;
  } catch (err) {
    console.warn("[analyzeAd] Analysis failed — using fallback:", err);
    return {
      main_subject: "product",
      secondary_elements: [],
      text_elements: [],
      visual_priority: ["product integrity", "label accuracy", "sharp edges"],
      composition_type: "close-up hero shot",
      subject_priority: "product must fill 70–80% of frame and be the clear visual anchor",
      lighting_style: "high contrast studio lighting with strong highlights and shadows",
      background_style: "clean studio backdrop that complements the product colour",
      effects_balance: "effects must remain secondary — they support the product, never overpower it",
      sharpness_goal: "maximum product detail clarity — label, logo, edges, and textures must be tack-sharp",
      avoid: [
        "wide cinematic composition",
        "small product in frame",
        "soft focus on product",
        "haze or fog over product",
      ],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 1B — Text detection (dedicated OCR scan)
// Runs in parallel with analyzeAd(). Focused entirely on reading every piece
// of text on the product — no composition, style, or scene concerns.
// A dedicated pass is far more accurate than asking for text as one field
// inside a larger analysis prompt.
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeText(
  imageBase64: string,
  mimeType: string
): Promise<TextAnalysis> {
  const client = getClient();

  const prompt = `You are a specialist OCR (optical character recognition) system analysing a product image.

Your ONLY job is to read every piece of text visible on the product — character by character, with zero errors.

This text will be used to instruct an AI image generator to reproduce the product exactly. Any mistake you make will appear in the final advertising image. Accuracy is critical.

Scan the ENTIRE image. Look for:
- Brand names and logos (including any stylised wordmarks)
- Product names and sub-names
- Taglines and slogans
- Ingredient lists, nutritional info, claims
- Volume/weight/size information
- Legal text, certifications, country of origin
- Engraved or embossed text on the product body
- Any numbers, symbols, or punctuation that appears on the product surface

For each distinct region of text, create one entry. Keep each entry to one logical block (e.g. one label section, not one word per entry).

Return this exact JSON:
{
  "detected_text": ["EXACT TEXT 1", "EXACT TEXT 2"],
  "regions": [
    {
      "location": "where on the product (e.g. front label, cap, side panel, bottom, neck label)",
      "text": "EXACT TEXT — copy every character verbatim, preserve line breaks with \\n",
      "style": "describe the visual style (e.g. large bold sans-serif brand name, small italic slogan, fine engraved text)"
    }
  ],
  "has_logo": true,
  "has_engraved_text": false
}

Rules:
- Copy text EXACTLY — do not correct spelling, capitalisation, or punctuation
- If text is partially obscured, copy what is visible and add "(partial)" after
- If you cannot read a character with certainty, use "?" as a placeholder
- Do NOT describe the text — copy it
- detected_text must contain every unique text string from regions, flattened

Return ONLY valid JSON. No markdown. No explanation.`;

  console.log(`[analyzeText] Stage 1B — model: ${TEXT_MODEL}`);

  try {
    const response = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        { inlineData: { mimeType, data: imageBase64 } },
        { text: prompt },
      ],
    });

    const raw    = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const json   = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(json) as TextAnalysis;

    console.log(`[analyzeText] Detected text:`, JSON.stringify(parsed.detected_text));
    console.log(`[analyzeText] Regions (${parsed.regions.length}):`, JSON.stringify(parsed.regions, null, 2));
    return parsed;
  } catch (err) {
    console.warn("[analyzeText] Text detection failed — using fallback:", err);
    return {
      detected_text: [],
      regions: [],
      has_logo: false,
      has_engraved_text: false,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 2A — Analysis-driven prompt builder
// Converts the AdAnalysis JSON + PromptContext into a generation prompt.
// Every prompt produced here enforces:
//   • product-first composition (70–80% of frame)
//   • exact logo/label preservation
//   • high contrast studio lighting
//   • negative constraints tailored to the actual product
// ─────────────────────────────────────────────────────────────────────────────

export function buildAdPrompt(
  analysis: AdAnalysis,
  ctx: PromptContext,
  textAnalysis?: TextAnalysis
): string {
  const { outputFormat, useProductCutout, strictMode } = ctx;

  // ── Text preservation block ──────────────────────────────────────────────
  const textPreservationBlock = buildTextPreservationBlock(textAnalysis, analysis.text_elements);

  // ── What may NOT be changed ──────────────────────────────────────────────
  const avoidBlock = [
    "create a new scene or replace the background",
    "invent objects, people, or elements not present in the original",
    "change the lighting style or colour palette",
    "add decorative effects, smoke, fire, or fantasy elements",
    "redesign or restructure the layout",
    "change the theme, mood, or visual identity",
    "add watermarks, icons, platform logos, or UI elements",
    "add any text not present in the original image",
    "alter, distort, or reinterpret the main subject",
  ].map(a => `- ${a}`).join("\n");

  // ── What may be done ─────────────────────────────────────────────────────
  const allowBlock = [
    "reframe and crop to fill the new canvas dimensions",
    "slightly reposition elements so nothing important is cut off",
    "extend the background edges using the same colours and style as the original",
    "adjust spacing and padding to suit the new aspect ratio",
    "rebalance element placement within the new format",
  ].map(a => `- ${a}`).join("\n");

  // ── Elements to preserve ─────────────────────────────────────────────────
  const preserveLines = [
    `Main subject: ${analysis.main_subject}`,
    analysis.secondary_elements.length > 0
      ? `Secondary elements: ${analysis.secondary_elements.join(", ")}`
      : null,
    `Composition style: ${analysis.composition_type}`,
    `Lighting: ${analysis.lighting_style}`,
    `Background: ${analysis.background_style}`,
    `Visual priority order: ${analysis.visual_priority.join(" → ")}`,
  ].filter(Boolean).join("\n");

  const productSourceNote = useProductCutout
    ? "SOURCE: An isolated product cutout is provided. Fit it into the new format — preserve all its visual properties exactly."
    : "SOURCE: A full image is provided. Recompose this exact image — do not replace or reimagine it.";

  const dimensionGuide = getDimensionGuide(outputFormat);

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
    "Elements that MUST be preserved unchanged:",
    preserveLines,
    "",
    "════════════════════════════════════════",
    "TEXT & LOGO PRESERVATION — HIGHEST PRIORITY",
    "Read and apply before anything else.",
    "════════════════════════════════════════",
    textPreservationBlock,
    textAnalysis?.has_engraved_text
      ? "\nEngraved and embossed text must remain physically legible — do not smooth, blur, or fill it in."
      : "",
    "",
    "════════════════════════════════════════",
    "YOU MAY",
    "════════════════════════════════════════",
    allowBlock,
    "",
    "════════════════════════════════════════",
    "YOU MAY NOT",
    "════════════════════════════════════════",
    avoidBlock,
  ];

  if (strictMode) {
    lines.push(
      "",
      "⚠ STRICT MODE — previous attempt introduced unwanted elements. Zero tolerance this retry:",
      "- Zero icons, watermarks, or platform logos anywhere in the image",
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

  return lines.filter(l => l !== null).join("\n");
}

function getDimensionGuide(format: OutputFormat): string {
  const ratio = format.width / format.height;
  if (ratio === 1)  return "Square canvas — centre all elements, equal visual weight on all sides.";
  if (ratio < 0.7)  return "Tall portrait — stack elements vertically, preserve top and bottom content.";
  if (ratio < 1)    return "Portrait — slight vertical emphasis, ensure nothing important is cropped at top or bottom.";
  if (ratio > 1.7)  return "Wide banner — elements spread horizontally, preserve left and right content.";
  return "Landscape — horizontal breathing room, ensure nothing important is cropped on the sides.";
}

/**
 * Builds the TEXT PRESERVATION section of the prompt.
 * Uses dedicated TextAnalysis when available (most accurate).
 * Falls back to text_elements from AdAnalysis, then to a generic rule.
 */
function buildTextPreservationBlock(
  textAnalysis: TextAnalysis | undefined,
  fallbackTextElements: string[]
): string {
  // Case 1: Full text analysis with per-region breakdown
  if (textAnalysis && textAnalysis.regions.length > 0) {
    const regionLines = textAnalysis.regions
      .map((r, i) =>
        [
          `  [Text region ${i + 1}]`,
          `  Location : ${r.location}`,
          `  Text     : "${r.text}"`,
          `  Style    : ${r.style}`,
          `  Rule     : Reproduce this text CHARACTER-FOR-CHARACTER. No changes whatsoever.`,
        ].join("\n")
      )
      .join("\n\n");

    const logoLine = textAnalysis.has_logo
      ? "A graphical logo is present on the product. Preserve its shape, colour, and layout exactly — do not redraw or simplify it."
      : "";

    const engravedLine = textAnalysis.has_engraved_text
      ? "Engraved/embossed text is present. Keep these details physically legible — do not smooth, blur, or fill them in."
      : "";

    return [
      `This product contains ${textAnalysis.regions.length} text region(s) that MUST appear in the output EXACTLY as listed below.`,
      "",
      regionLines,
      "",
      logoLine,
      engravedLine,
      "",
      "STRICT TEXT RULES (non-negotiable):",
      "- Reproduce every letter, number, and symbol exactly — same spelling, same capitalisation, same spacing",
      "- Do NOT change, rephrase, or stylise any text",
      "- Do NOT let fire, smoke, light effects, or any visual element overlap text areas",
      "- Do NOT add glow, haze, or bloom over text areas",
      "- Do NOT blur or soften any text on the product surface",
      "- Do NOT replace text with random symbols, approximations, or alternative characters",
      "- If you cannot reproduce a piece of text perfectly, render that area sharp and unmodified — never distort it",
    ]
      .filter(Boolean)
      .join("\n");
  }

  // Case 2: Flat text list from AdAnalysis (less detailed but still useful)
  if (fallbackTextElements.length > 0) {
    const textList = fallbackTextElements.map(t => `  • "${t}"`).join("\n");
    return [
      "The following text appears on the product and must be reproduced CHARACTER-FOR-CHARACTER:",
      "",
      textList,
      "",
      "Same font weight. Same colour. Same layout. Same spelling.",
      "Do NOT simplify, paraphrase, or invent any text or graphic mark on the product.",
      "Do NOT let effects or lighting wash out, blur, or distort any text area.",
    ].join("\n");
  }

  // Case 3: Generic fallback
  return [
    "Reproduce all visible text, logos, and labels on the product EXACTLY as they appear in the source image.",
    "Same spelling. Same capitalisation. Same layout. Same visual weight.",
    "Do NOT alter, distort, blur, or overlay any text on the product surface.",
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 2B — Image generation
// Sends the built prompt + source image to the generation model.
// When adAnalysis is supplied the analysis-driven prompt is used.
// When omitted (legacy calls) it falls back to the original buildPrompt().
// ─────────────────────────────────────────────────────────────────────────────

export async function generateCreativeVariant(
  ctx: PromptContext,
  sourceImageBase64: string,
  sourceImageMimeType: string,
  adAnalysis?: AdAnalysis,
  textAnalysis?: TextAnalysis
): Promise<GenerativeResult> {
  const client = getClient();

  const prompt = adAnalysis
    ? buildAdPrompt(adAnalysis, ctx, textAnalysis)
    : buildPrompt(ctx);

  console.log(`[generateCreativeVariant] Stage 2 — model: ${GENERATION_MODEL}`);
  console.log(`[generateCreativeVariant] Prompt:\n${"─".repeat(60)}\n${prompt}\n${"─".repeat(60)}`);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: GENERATION_MODEL,
        // Direct multimodal format — image first, then prompt text
        contents: [
          { inlineData: { mimeType: sourceImageMimeType, data: sourceImageBase64 } },
          { text: prompt },
        ],
        config: { responseModalities: ["IMAGE", "TEXT"] },
      });

      const responseModel = (response as unknown as Record<string, unknown>).modelVersion ?? GENERATION_MODEL;
      console.log(`[generateCreativeVariant] Response model: ${responseModel}`);

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find(
        (p) => p.inlineData?.data && p.inlineData?.mimeType?.startsWith("image/")
      );

      if (imagePart?.inlineData?.data) {
        return {
          imageBase64: imagePart.inlineData.data,
          mimeType:    imagePart.inlineData.mimeType ?? "image/png",
          promptUsed:  prompt,
        };
      }

      const summary = parts.map((p) => ({
        hasText:      !!p.text,
        hasInlineData: !!p.inlineData,
        mimeType:     p.inlineData?.mimeType,
        dataLen:      p.inlineData?.data?.length ?? 0,
      }));
      throw new Error(`No image in response. Parts: ${JSON.stringify(summary)}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[generateCreativeVariant] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, lastError.message);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError ?? new Error("Gemini generation failed after retries");
}

// ─────────────────────────────────────────────────────────────────────────────
// Artifact detection — finds UI elements / watermarks in source image
// Called before generation; non-fatal if it fails
// ─────────────────────────────────────────────────────────────────────────────

export async function detectArtifactRegions(
  imageBase64: string,
  mimeType: string
): Promise<ArtifactRegion[]> {
  const client = getClient();

  const prompt = `You are analysing a product photo for unwanted UI artifacts that must be removed before the image is used in AI advertising generation.

Look specifically for elements that are NOT part of the original product or its environment:
- Watermarks: semi-transparent text, brand overlays, copyright marks
- Corner icons: small social media icons, app icons, share buttons placed at image corners
- UI overlays: price tags, ratings, badges, "sale" stickers applied digitally over the image
- Platform logos: Instagram, Pinterest, TikTok, Shopify, etc. visible in the image
- Attribution text: photo credit, website URLs, promotional text overlaid on the image

Do NOT flag:
- The product itself, including its label, packaging, or branding
- Natural background elements (floors, walls, tables, surfaces)
- Shadows, reflections, or natural lighting effects
- Any element that is clearly part of the original photo scene

For each artifact found, respond with a JSON array:
[
  {
    "x": <left edge as 0-100 percentage of image width>,
    "y": <top edge as 0-100 percentage of image height>,
    "width": <width as 0-100 percentage of image width>,
    "height": <height as 0-100 percentage of image height>,
    "type": "<watermark|logo|overlay|icon|text|ui_element>",
    "description": "<brief what it is>"
  }
]

If no artifacts are found, return: []

Return ONLY valid JSON. No markdown, no explanation.`;

  try {
    const response = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt },
        ],
      }],
    });

    const raw    = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    const json   = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(json) as ArtifactRegion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Output validation — checks a generated image for remaining artifacts
// Returns clean: false if the output should be retried with strictMode
// ─────────────────────────────────────────────────────────────────────────────

export async function validateImageOutput(
  imageBase64: string,
  mimeType: string
): Promise<{ clean: boolean; issues: string[] }> {
  const client = getClient();

  const prompt = `You are a quality control checker for AI-generated advertising creatives.

Inspect this image and check for these failure modes:
1. UI artifacts: icons, watermarks, badges, interface elements, social logos that do not belong in an ad
2. Repeated corner elements: suspicious icons or shapes in multiple corners
3. Text contamination: random characters, numbers, or labels not part of an intentional design
4. Product distortion: the main product appears warped, melted, stretched, or unrecognisably altered
5. Tiling artefacts: visible seams, repeating patches, or obvious AI generation failures

This is an advertising creative — clean, professional imagery with the product as the hero is expected. Minor background elements, natural shadows, and intentional design elements are fine.

Respond with JSON:
{
  "clean": true,
  "issues": []
}

or if problems are found:
{
  "clean": false,
  "issues": ["concise description of issue 1", "..."]
}

Return ONLY valid JSON. No markdown, no explanation.`;

  try {
    const response = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt },
        ],
      }],
    });

    const raw    = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '{"clean":true,"issues":[]}';
    const json   = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(json) as { clean: boolean; issues: string[] };
    return { clean: parsed.clean ?? true, issues: parsed.issues ?? [] };
  } catch {
    return { clean: true, issues: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Product category analysis — legacy function kept for compatibility
// The new analyzeAd() supersedes this for generation purposes.
// Still used by orchestrator for logging and fallback metadata.
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeProductCategory(
  imageBase64: string,
  mimeType: string
): Promise<ProductAnalysis> {
  const client = getClient();

  const systemPrompt = `You are a product photography and advertising expert.
Analyse this product image and return a JSON object with exactly these fields:
{
  "category": "short product category label, e.g. supplement bottle, perfume, food snack, skincare serum",
  "suggestedScenes": ["2 to 3 short scene descriptions that would make great ad backgrounds for this product"],
  "colorTone": "describe the dominant colour palette and tone of the product in one line",
  "adStyle": "the advertising style that fits this product best, e.g. luxury lifestyle, health wellness, bold consumer, minimalist premium"
}
Return only valid JSON. No markdown, no explanation.`;

  try {
    const response = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: systemPrompt },
          ],
        },
      ],
    });

    const raw    = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const json   = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(json) as ProductAnalysis;
    return parsed;
  } catch {
    return {
      category: "product",
      suggestedScenes: ["clean studio background", "lifestyle setting"],
      colorTone: "neutral",
      adStyle: "professional product advertising",
    };
  }
}
