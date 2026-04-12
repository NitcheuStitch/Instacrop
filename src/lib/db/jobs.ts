import { createServiceClient } from "@/lib/supabase/server";
import type { DbJob, DbOutput, GenerationSettings, JobStatus, JobWithOutputs } from "@/types";

export async function createJob(params: {
  userId: string;
  originalImageUrl: string;
  originalFilename: string;
  settings: GenerationSettings;
}): Promise<DbJob> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      user_id: params.userId,
      original_image_url: params.originalImageUrl,
      original_filename: params.originalFilename,
      status: "pending",
      settings_json: params.settings,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create job: ${error.message}`);
  return data as DbJob;
}

export async function getJob(jobId: string): Promise<DbJob | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("jobs")
    .select()
    .eq("id", jobId)
    .single();

  if (error) return null;
  return data as DbJob;
}

export async function getJobWithOutputs(jobId: string): Promise<JobWithOutputs | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("jobs")
    .select("*, outputs(*)")
    .eq("id", jobId)
    .single();

  if (error) return null;
  return data as JobWithOutputs;
}

export async function getUserJobs(userId: string): Promise<DbJob[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("jobs")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return [];
  return data as DbJob[];
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus
): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("jobs")
    .update({ status })
    .eq("id", jobId);

  if (error) throw new Error(`Failed to update job status: ${error.message}`);
}

export async function createOutputRecord(params: {
  jobId: string;
  formatName: string;
  width: number;
  height: number;
  variantName: string;
  mode: string;
}): Promise<DbOutput> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("outputs")
    .insert({
      job_id: params.jobId,
      format_name: params.formatName,
      width: params.width,
      height: params.height,
      variant_name: params.variantName,
      mode: params.mode,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create output record: ${error.message}`);
  return data as DbOutput;
}

export async function updateOutputRecord(
  outputId: string,
  params: { outputUrl?: string; promptUsed?: string; status: string }
): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("outputs")
    .update({
      output_url: params.outputUrl,
      prompt_used: params.promptUsed,
      status: params.status,
    })
    .eq("id", outputId);

  if (error) throw new Error(`Failed to update output: ${error.message}`);
}

export async function logGeneration(params: {
  jobId: string;
  provider: string;
  requestType: string;
  status: "success" | "error";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = await createServiceClient();

  await supabase.from("generation_logs").insert({
    job_id: params.jobId,
    provider: params.provider,
    request_type: params.requestType,
    status: params.status,
    error_message: params.errorMessage ?? null,
    metadata_json: params.metadata ?? {},
  });
}
