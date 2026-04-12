import { GoogleGenAI, Modality } from "@google/genai";
import type { GenerativeResult, PromptContext } from "@/types";
import { buildPrompt } from "./prompt-builder";

// ─────────────────────────────────────────────────────────────────────────────
// Gemini image generation provider
// All AI calls flow through this module — keep UI and orchestration out.
// ─────────────────────────────────────────────────────────────────────────────

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

const GENERATION_MODEL = "gemini-2.0-flash-preview-image-generation";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateCreativeVariant(
  ctx: PromptContext,
  sourceImageBase64: string,
  sourceImageMimeType: string
): Promise<GenerativeResult> {
  const client = getClient();
  const prompt = buildPrompt(ctx);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: GENERATION_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: sourceImageMimeType,
                  data: sourceImageBase64,
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error("Gemini returned no candidates");
      }

      const parts = candidates[0].content?.parts ?? [];
      const imagePart = parts.find((p) => p.inlineData?.mimeType?.startsWith("image/"));

      if (!imagePart?.inlineData?.data) {
        throw new Error("Gemini returned no image data in response");
      }

      return {
        imageBase64: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType ?? "image/png",
        promptUsed: prompt,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  throw lastError ?? new Error("Gemini generation failed after retries");
}

export async function analyzeProductImage(
  imageBase64: string,
  mimeType: string
): Promise<string> {
  const client = getClient();

  const response = await client.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: { mimeType, data: imageBase64 },
          },
          {
            text: "Describe this product image in 2-3 sentences. Focus on: what the product is, its color and style, and what kind of advertising background would suit it best. Be specific and concise.",
          },
        ],
      },
    ],
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.text ?? "Product image provided.";
}
