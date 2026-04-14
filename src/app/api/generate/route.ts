import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getJob } from "@/lib/db/jobs";
import { runGenerationJob } from "@/lib/ai/orchestrator";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await req.json();

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const job = await getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Kick off generation async — respond immediately so the UI can poll
    runGenerationJob({
      jobId: job.id,
      originalImageUrl: job.original_image_url,
      settings: job.settings_json,
    }).catch((err) => {
      console.error(`Generation job ${jobId} failed:`, err);
    });

    return NextResponse.json({ status: "started" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start generation";
    console.error("[/api/generate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
