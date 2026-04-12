// ─────────────────────────────────────────────────────────────────────────────
// Core domain types for InstaCrop
// ─────────────────────────────────────────────────────────────────────────────

export type OutputFormat = {
  id: string;
  label: string;
  width: number;
  height: number;
  platform: string;
  aspectRatio: string;
};

export type GenerationMode =
  | "smart_crop"
  | "background_expand"
  | "recompose"
  | "product_in_scene";

export type BackgroundStyle =
  | "studio"
  | "lifestyle"
  | "premium"
  | "vibrant"
  | "minimal";

export type JobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "partial";

export type OutputStatus = "pending" | "generating" | "done" | "failed";

// ─────────────────────────────────────────────────────────────────────────────
// Job settings (sent from frontend → backend)
// ─────────────────────────────────────────────────────────────────────────────

export type GenerationSettings = {
  formats: OutputFormat[];
  mode: GenerationMode;
  backgroundStyle: BackgroundStyle;
  variantCount: number;
  isolateProduct: boolean;
  useOriginalBackground: boolean;
  preserveComposition: boolean;
  adMood?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Database row types (mirrors Supabase schema)
// ─────────────────────────────────────────────────────────────────────────────

export type DbUser = {
  id: string;
  email: string;
  created_at: string;
};

export type DbJob = {
  id: string;
  user_id: string;
  original_image_url: string;
  original_filename: string;
  status: JobStatus;
  settings_json: GenerationSettings;
  created_at: string;
};

export type DbOutput = {
  id: string;
  job_id: string;
  format_name: string;
  width: number;
  height: number;
  variant_name: string;
  mode: GenerationMode;
  output_url: string | null;
  prompt_used: string | null;
  status: OutputStatus;
  created_at: string;
};

export type DbMask = {
  id: string;
  job_id: string;
  mask_url: string;
  cutout_url: string;
  created_at: string;
};

export type DbGenerationLog = {
  id: string;
  job_id: string;
  provider: string;
  request_type: string;
  status: "success" | "error";
  error_message: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// API request / response shapes
// ─────────────────────────────────────────────────────────────────────────────

export type UploadResponse = {
  url: string;
  path: string;
  filename: string;
};

export type CreateJobRequest = {
  originalImageUrl: string;
  originalFilename: string;
  settings: GenerationSettings;
};

export type CreateJobResponse = {
  jobId: string;
};

export type GenerateRequest = {
  jobId: string;
};

export type JobWithOutputs = DbJob & {
  outputs: DbOutput[];
};

// ─────────────────────────────────────────────────────────────────────────────
// AI provider types
// ─────────────────────────────────────────────────────────────────────────────

export type PromptContext = {
  productType: string;
  sourceImageDescription: string;
  outputFormat: OutputFormat;
  mode: GenerationMode;
  backgroundStyle: BackgroundStyle;
  variantName: string;
  adMood?: string;
  preserveComposition: boolean;
  hasIsolatedProduct: boolean;
};

export type GenerativeResult = {
  imageBase64: string;
  mimeType: string;
  promptUsed: string;
};
