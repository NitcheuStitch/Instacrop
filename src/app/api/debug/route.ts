import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServiceClient();

    // Latest 5 generation logs
    const { data: logs } = await supabase
      .from("generation_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    // Latest 3 jobs
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, status, created_at")
      .order("created_at", { ascending: false })
      .limit(3);

    // Latest 5 outputs
    const { data: outputs } = await supabase
      .from("outputs")
      .select("id, status, format_name, variant_name, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    return NextResponse.json({ jobs, logs, outputs });
  } catch (err) {
    return NextResponse.json({ error: String(err) });
  }
}
