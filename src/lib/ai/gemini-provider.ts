import { GoogleGenAI } from "@google/genai";
import type { ArtifactRegion, GenerativeResult, ProductAnalysis, PromptContext } from "@/types";
import { buildPrompt } from "./prompt-builder";

// ─────────────────────────────────────────────────────────────────────────────
// Gemini provider — all AI calls live here
// ─────────────────────────────────────────────────────────────────────────────

// ── Active model config ───────────────────────────────────────────────────────
// Change IMAGE_MODEL here to switch the image generation model globally.
// This is the single place that controls which model is used for all image output.
export const IMAGE_MODEL = "gemini-3-pro-image-preview";
const TEXT_MODEL         = "gemini-2.0-flash";

// Log active model once when this module is first loaded (server startup)
console.log("Active image model:", IMAGE_MODEL);

const MAX_RETRIES    = 2;
const RETRY_DELAY_MS = 3000;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Image generation
// ─────────────────────────────────────────────────────────────────────────────

export async function generateCreativeVariant(
  ctx: PromptContext,
  sourceImageBase64: string,
  sourceImageMimeType: string
): Promise<GenerativeResult> {
  const client = getClient();
  const prompt = buildPrompt(ctx);
  let lastError: Error | null = null;

  console.log(`[gemini-provider] generateCreativeVariant — model: ${IMAGE_MODEL}`);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: IMAGE_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: sourceImageMimeType, data: sourceImageBase64 } },
              { text: prompt },
            ],
          },
        ],
        config: { responseModalities: ["IMAGE", "TEXT"] },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find(
        (p) => p.inlineData?.data && p.inlineData?.mimeType?.startsWith("image/")
      );

      if (imagePart?.inlineData?.data) {
        return {
          imageBase64: imagePart.inlineData.data,
          mimeType: imagePart.inlineData.mimeType ?? "image/png",
          promptUsed: prompt,
        };
      }

      const summary = parts.map((p) => ({
        hasText: !!p.text,
        hasinlineData: !!p.inlineData,
        mimeType: p.inlineData?.mimeType,
        dataLen: p.inlineData?.data?.length ?? 0,
      }));
      throw new Error(`No image in response. Parts: ${JSON.stringify(summary)}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError ?? new Error("Gemini generation failed after retries");
}

// ─────────────────────────────────────────────────────────────────────────────
// Artifact detection — finds UI elements / watermarks that should be removed
// Called on source image before generation
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

    const raw = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    const json = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(json) as ArtifactRegion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Output validation — checks a generated image for remaining artifacts
// Returns clean: false if the output should be retried
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

    const raw  = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '{"clean":true,"issues":[]}';
    const json = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(json) as { clean: boolean; issues: string[] };
    return { clean: parsed.clean ?? true, issues: parsed.issues ?? [] };
  } catch {
    return { clean: true, issues: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Product analysis — detects category and suggests scene context
// Called once per job, result passed into every prompt
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

    const raw = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    // Strip markdown code fences if model adds them
    const json = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(json) as ProductAnalysis;
    return parsed;
  } catch {
    // Non-fatal fallback
    return {
      category: "product",
      suggestedScenes: ["clean studio background", "lifestyle setting"],
      colorTone: "neutral",
      adStyle: "professional product advertising",
    };
  }
}
