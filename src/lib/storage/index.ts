import { createServiceClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";

const UPLOADS_BUCKET = "uploads";
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

  const { data } = supabase.storage.from(UPLOADS_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
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

export async function downloadFileAsBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
