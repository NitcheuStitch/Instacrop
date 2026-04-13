import { createServiceClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";

const UPLOADS_BUCKET = "Uploads";
const OUTPUTS_BUCKET = "outputs";

export async function uploadOriginalImage(params: {
  fileBuffer: Buffer;
  filename: string;
  mimeType: string;
  userId: string;
}): Promise<{ url: string; path: string }> {
  const supabase = await createServiceClient();
  const ext = params.filename.split(".").pop() ?? "jpg";
  const path = `${params.userId}/${uuidv4()}.${ext}`;

  const { error } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .upload(path, params.fileBuffer, {
      contentType: params.mimeType,
      upsert: false,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  // Generate a long-lived signed URL (1 year) — works for display and orchestrator download
  const { data: signedData, error: signedError } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365);

  if (signedError || !signedData) throw new Error(`Failed to create signed URL: ${signedError?.message}`);

  return { url: signedData.signedUrl, path };
}

export async function uploadGeneratedOutput(params: {
  imageBuffer: Buffer;
  jobId: string;
  outputId: string;
  mimeType?: string;
}): Promise<{ url: string; path: string }> {
  const supabase = await createServiceClient();
  const ext = params.mimeType === "image/png" ? "png" : "jpg";
  const path = `${params.jobId}/${params.outputId}.${ext}`;

  const { error } = await supabase.storage
    .from(OUTPUTS_BUCKET)
    .upload(path, params.imageBuffer, {
      contentType: params.mimeType ?? "image/jpeg",
      upsert: true,
    });

  if (error) throw new Error(`Output upload failed: ${error.message}`);

  const { data } = supabase.storage.from(OUTPUTS_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

// Upload a product cutout (cropped PNG) — same bucket as originals
export async function uploadCutoutImage(params: {
  fileBuffer: Buffer;
  userId: string;
  originalFilename: string;
}): Promise<{ url: string; path: string }> {
  const supabase = await createServiceClient();
  const path = `${params.userId}/cutout_${uuidv4()}.png`;

  const { error } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .upload(path, params.fileBuffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (error) throw new Error(`Cutout upload failed: ${error.message}`);

  const { data: signedData, error: signedError } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365);

  if (signedError || !signedData)
    throw new Error(`Failed to create signed URL for cutout: ${signedError?.message}`);

  return { url: signedData.signedUrl, path };
}

// Download a private upload by its storage path using the service client
export async function downloadUploadAsBuffer(storagePath: string): Promise<Buffer> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .download(storagePath);

  if (error) throw new Error(`Failed to download upload: ${error.message}`);
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Download any public file by URL (used for outputs)
export async function downloadFileAsBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
