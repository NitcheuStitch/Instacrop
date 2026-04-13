import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getJobWithOutputs } from "@/lib/db/jobs";
import archiver from "archiver";
import { Writable, PassThrough } from "stream";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await req.json();
  const job = await getJobWithOutputs(jobId);

  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const completedOutputs = job.outputs.filter((o) => o.status === "done" && o.output_url);

  if (completedOutputs.length === 0) {
    return NextResponse.json({ error: "No completed outputs to download" }, { status: 400 });
  }

  // Stream a ZIP back to the client
  const passThrough = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 6 } });

  archive.pipe(passThrough as unknown as Writable);

  for (const output of completedOutputs) {
    try {
      const res = await fetch(output.output_url!);
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      // Strip query params before extracting extension (Supabase signed URLs include ?token=...)
      const pathname = new URL(output.output_url!).pathname;
      const ext = pathname.split(".").pop() ?? "jpg";
      const filename = `${output.format_name.replace(/\s+/g, "_")}_${output.variant_name.replace(/\s+/g, "_")}_${output.width}x${output.height}.${ext}`;
      archive.append(buffer, { name: filename });
    } catch {
      continue;
    }
  }

  archive.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of passThrough) {
    chunks.push(chunk as Buffer);
  }

  const zipBuffer = Buffer.concat(chunks);

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="instacrop_${jobId}.zip"`,
    },
  });
}
