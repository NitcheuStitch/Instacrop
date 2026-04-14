import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserJobs } from "@/lib/db/jobs";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ImageIcon, Clock } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { JobStatus } from "@/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const jobs = await getUserJobs(user.id);

  return (
    <div className="min-h-screen bg-neutral-950">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Dashboard</h1>
              <p className="text-neutral-400 text-sm mt-1">
                {user.email}
              </p>
            </div>
            <Link href="/generate">
              <Button size="md">
                <Plus className="h-4 w-4" />
                New generation
              </Button>
            </Link>
          </div>

          {jobs.length === 0 ? (
            <div className="text-center py-20 rounded-2xl border border-dashed border-white/10">
              <div className="h-12 w-12 rounded-xl bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                <ImageIcon className="h-6 w-6 text-neutral-500" />
              </div>
              <h3 className="text-lg font-medium text-neutral-200 mb-2">No generations yet</h3>
              <p className="text-neutral-500 text-sm mb-6">
                Upload a product image to create your first set of ad creatives.
              </p>
              <Link href="/generate">
                <Button>Start your first generation</Button>
              </Link>
            </div>
          ) : (
            <div>
              <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-4">
                Recent jobs
              </h2>
              <div className="space-y-2">
                {jobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/results/${job.id}`}
                    className="flex items-center justify-between p-4 rounded-xl border border-white/8 bg-neutral-900/50 hover:bg-neutral-900 hover:border-white/15 transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-neutral-800 overflow-hidden shrink-0 relative">
                        {job.original_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={job.original_image_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-neutral-600 m-auto" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-200 truncate">
                          {job.original_filename}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Clock className="h-3 w-3 text-neutral-600" />
                          <span className="text-xs text-neutral-600">
                            {formatRelativeTime(job.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <JobStatusBadge status={job.status} />
                      <span className="text-xs text-neutral-600 group-hover:text-neutral-400 transition-colors">
                        View results →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function JobStatusBadge({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, { label: string; variant: "success" | "warning" | "error" | "info" | "default" }> = {
    completed: { label: "Completed", variant: "success" },
    processing: { label: "Processing", variant: "info" },
    pending: { label: "Pending", variant: "default" },
    failed: { label: "Failed", variant: "error" },
    partial: { label: "Partial", variant: "warning" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}
