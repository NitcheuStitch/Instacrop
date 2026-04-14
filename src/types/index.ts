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

// Bounding box in canvas display coordinates, plus original image scale factors
export type SelectionBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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
  // Product selection
  useProductCutout: boolean;
  productCutoutUrl?: string; // signed URL of the cropped product image
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

export type ProductAnalysis = {
  category: string;          // e.g. "supplement bottle", "food product", "perfume"
  suggestedScenes: string[]; // e.g. ["wellness studio", "clean white shelf"]
  colorTone: string;         // e.g. "warm earthy tones", "clean white and gold"
  adStyle: string;           // e.g. "health & wellness", "luxury lifestyle"
};

// Structured output from the 2-stage ad analysis (Stage 1)
export type AdAnalysis = {
  main_subject: string;
  secondary_elements: string[];
  text_elements: string[];        // exact brand/logo text on product — preserved verbatim
  visual_priority: string[];
  composition_type: string;
  subject_priority: string;
  lighting_style: string;
  background_style: string;
  effects_balance: string;
  sharpness_goal: string;
  avoid: string[];
};

// A single region of text detected on the product
export type TextRegion = {
  location: string;   // e.g. "front label", "cap top", "side panel", "bottom base"
  text: string;       // exact text content, character-for-character
  style: string;      // e.g. "large bold brand name", "small italic slogan", "engraved"
};

// Output of the dedicated text-detection scan (analyzeText)
// Focused purely on OCR accuracy — no style or composition concerns
export type TextAnalysis = {
  detected_text: string[];    // flat list for quick prompt injection
  regions: TextRegion[];      // per-region breakdown for spatial prompt rules
  has_logo: boolean;          // true if a graphical logo (not just text) is present
  has_engraved_text: boolean; // true if any text is engraved/embossed (needs extra sharpness rule)
};

export type PromptContext = {
  outputFormat: OutputFormat;
  mode: GenerationMode;
  backgroundStyle: BackgroundStyle;
  variantName: string;
  adMood?: string;
  preserveComposition: boolean;
  // Product info
  useProductCutout: boolean;  // true = image IS the isolated product
  productAnalysis?: ProductAnalysis;
  // Set to true on validation-failure retries to apply stricter anti-artifact rules
  strictMode?: boolean;
};

export type GenerativeResult = {
  imageBase64: string;
  mimeType: string;
  promptUsed: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Artifact detection types
// ─────────────────────────────────────────────────────────────────────────────

export type ArtifactType =
  | "watermark"
  | "logo"
  | "overlay"
  | "icon"
  | "text"
  | "ui_element";

export type ArtifactRegion = {
  x: number;           // 0–100 percentage of image width
  y: number;           // 0–100 percentage of image height
  width: number;       // 0–100 percentage of image width
  height: number;      // 0–100 percentage of image height
  type: ArtifactType;
  description?: string;
};

export type ArtifactScanResult = {
  regions: ArtifactRegion[];
  cleaned: boolean;    // true if any regions were masked out
};
