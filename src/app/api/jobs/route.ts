import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createJob, getUserJobs } from "@/lib/db/jobs";
import type { CreateJobRequest } from "@/types";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: CreateJobRequest = await req.json();

  if (!body.originalImageUrl || !body.settings) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const job = await createJob({
    userId: user.id,
    originalImageUrl: body.originalImageUrl,
    originalFilename: body.originalFilename,
    settings: body.settings,
  });

  return NextResponse.json({ jobId: job.id });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await getUserJobs(user.id);
  return NextResponse.json({ jobs });
}
