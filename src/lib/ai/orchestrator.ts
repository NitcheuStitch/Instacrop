import {
  generateCreativeVariant,
  analyzeProductCategory,
  detectArtifactRegions,
  validateImageOutput,
} from "./gemini-provider";
import { getVariantNames } from "./prompt-builder";
import { removeArtifactRegions } from "@/lib/image/preprocessor";
import { uploadGeneratedOutput, downloadFileAsBuffer } from "@/lib/storage";
import {
  createOutputRecord,
  updateOutputRecord,
  updateJobStatus,
  logGeneration,
} from "@/lib/db/jobs";
import type { ArtifactRegion, GenerationSettings, ProductAnalysis, PromptContext } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Generation orchestrator
// Loops formats × variants, resolves source image, calls Gemini, saves results.
// ─────────────────────────────────────────────────────────────────────────────

export async function runGenerationJob(params: {
  jobId: string;
  originalImageUrl: string;
  settings: GenerationSettings;
}): Promise<void> {
  const { jobId, originalImageUrl, settings } = params;

  await updateJobStatus(jobId, "processing");

  try {
    // ── Resolve source image ────────────────────────────────────────────────
    // If user selected a product cutout, use that as the generation source.
    // Otherwise fall back to the original image.
    const useProductCutout =
      settings.useProductCutout && !!settings.productCutoutUrl;

    const sourceUrl = useProductCutout
      ? settings.productCutoutUrl!
      : originalImageUrl;

    const rawSourceBuffer = await downloadFileAsBuffer(sourceUrl);
    const sourceMimeType  = detectMimeType(sourceUrl);

    // ── Artifact detection + preprocessing ─────────────────────────────────
    // Scan the source image for UI overlays / watermarks and blur them out.
    // Non-fatal — if detection fails we proceed with the original buffer.
    let sourceBuffer  = rawSourceBuffer;
    let artifactRegions: ArtifactRegion[] = [];
    try {
      const rawBase64 = rawSourceBuffer.toString("base64");
      artifactRegions = await detectArtifactRegions(rawBase64, sourceMimeType);

      if (artifactRegions.length > 0) {
        sourceBuffer = await removeArtifactRegions(rawSourceBuffer, artifactRegions);
        await logGeneration({
          jobId,
          provider: "gemini",
          requestType: "artifact_removal",
          status: "success",
          metadata: { artifactCount: artifactRegions.length, regions: artifactRegions },
        });
      }
    } catch (err) {
      console.warn(`[orchestrator] artifact detection failed for job ${jobId}:`, err);
      sourceBuffer = rawSourceBuffer;
    }

    const sourceBase64 = sourceBuffer.toString("base64");

    // ── Product analysis ────────────────────────────────────────────────────
    // Analyse to detect category, tone, and suggested scenes.
    // Non-fatal — falls back to generic values inside analyzeProductCategory.
    let productAnalysis: ProductAnalysis | undefined;
    try {
      productAnalysis = await analyzeProductCategory(sourceBase64, sourceMimeType);
      await logGeneration({
        jobId,
        provider: "gemini",
        requestType: "product_analysis",
        status: "success",
        metadata: { productAnalysis },
      });
    } catch (err) {
      console.warn(`[orchestrator] product analysis failed for job ${jobId}:`, err);
    }

    // ── Generate formats × variants ─────────────────────────────────────────
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
          outputFormat: format,
          mode: settings.mode,
          backgroundStyle: settings.backgroundStyle,
          variantName,
          adMood: settings.adMood,
          preserveComposition: settings.preserveComposition,
          useProductCutout,
          productAnalysis,
        };

        try {
          let result = await generateCreativeVariant(ctx, sourceBase64, sourceMimeType);

          // ── Output validation ─────────────────────────────────────────────
          // Check the generated image for leftover artifacts or quality issues.
          // If problems are found, retry once with a stricter prompt addendum.
          try {
            const validation = await validateImageOutput(result.imageBase64, result.mimeType);
            if (!validation.clean && validation.issues.length > 0) {
              console.warn(`[orchestrator] output validation failed for ${outputRecord.id}:`, validation.issues);
              await logGeneration({
                jobId,
                provider: "gemini",
                requestType: "output_validation",
                status: "error",
                errorMessage: validation.issues.join("; "),
                metadata: { formatId: format.id, variantName },
              });
              // Retry with strict anti-artifact mode
              const strictCtx: PromptContext = { ...ctx, strictMode: true };
              result = await generateCreativeVariant(strictCtx, sourceBase64, sourceMimeType);
            }
          } catch {
            // Validation failure is non-fatal — keep the original result
          }

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
            metadata: { formatId: format.id, variantName, mode: settings.mode, useProductCutout },
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
  const pathname = url.split("?")[0].toLowerCase();
  if (pathname.endsWith(".png"))  return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}
