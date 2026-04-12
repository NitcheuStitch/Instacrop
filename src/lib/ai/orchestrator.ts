import { generateCreativeVariant, analyzeProductImage } from "./gemini-provider";
import { getVariantNames } from "./prompt-builder";
import { uploadGeneratedOutput, downloadFileAsBuffer } from "@/lib/storage";
import {
  createOutputRecord,
  updateOutputRecord,
  updateJobStatus,
  logGeneration,
} from "@/lib/db/jobs";
import type { GenerationSettings, PromptContext } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Generation orchestrator
// Loops through formats × variants, calls Gemini, saves results.
// ─────────────────────────────────────────────────────────────────────────────

export async function runGenerationJob(params: {
  jobId: string;
  originalImageUrl: string;
  settings: GenerationSettings;
}): Promise<void> {
  const { jobId, originalImageUrl, settings } = params;

  await updateJobStatus(jobId, "processing");

  try {
    // Fetch the source image once
    const sourceBuffer = await downloadFileAsBuffer(originalImageUrl);
    const sourceBase64 = sourceBuffer.toString("base64");
    const sourceMimeType = detectMimeType(originalImageUrl);

    // Analyze the product to improve prompts
    let productDescription = "Product image provided.";
    try {
      productDescription = await analyzeProductImage(sourceBase64, sourceMimeType);
    } catch {
      // Non-fatal — use fallback description
    }

    const variantNames = getVariantNames(settings.variantCount);
    let allSucceeded = true;

    for (const format of settings.formats) {
      for (const variantName of variantNames) {
        const outputRecord = await createOutputRecord({
          jobId,
          formatName: format.label,
          width: format.width,
          height: format.height,
          variantName,
          mode: settings.mode,
        });

        await updateOutputRecord(outputRecord.id, { status: "generating" });

        const ctx: PromptContext = {
          productType: "product",
          sourceImageDescription: productDescription,
          outputFormat: format,
          mode: settings.mode,
          backgroundStyle: settings.backgroundStyle,
          variantName,
          adMood: settings.adMood,
          preserveComposition: settings.preserveComposition,
          hasIsolatedProduct: settings.isolateProduct,
        };

        try {
          const result = await generateCreativeVariant(ctx, sourceBase64, sourceMimeType);

          const imageBuffer = Buffer.from(result.imageBase64, "base64");
          const { url: outputUrl } = await uploadGeneratedOutput({
            imageBuffer,
            jobId,
            outputId: outputRecord.id,
            mimeType: result.mimeType,
          });

          await updateOutputRecord(outputRecord.id, {
            outputUrl,
            promptUsed: result.promptUsed,
            status: "done",
          });

          await logGeneration({
            jobId,
            provider: "gemini",
            requestType: "generate_creative_variant",
            status: "success",
            metadata: {
              formatId: format.id,
              variantName,
              mode: settings.mode,
            },
          });
        } catch (err) {
          allSucceeded = false;
          const errorMessage = err instanceof Error ? err.message : String(err);

          await updateOutputRecord(outputRecord.id, { status: "failed" });

          await logGeneration({
            jobId,
            provider: "gemini",
            requestType: "generate_creative_variant",
            status: "error",
            errorMessage,
            metadata: { formatId: format.id, variantName },
          });
        }
      }
    }

    await updateJobStatus(jobId, allSucceeded ? "completed" : "partial");
  } catch (err) {
    await updateJobStatus(jobId, "failed");
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logGeneration({
      jobId,
      provider: "gemini",
      requestType: "orchestration",
      status: "error",
      errorMessage,
    });
    throw err;
  }
}

function detectMimeType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}
