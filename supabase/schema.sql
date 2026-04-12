-- ─────────────────────────────────────────────────────────────────────────────
-- InstaCrop — Supabase Schema
-- Run this in your Supabase SQL editor to set up the database.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- jobs
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_image_url text not null,
  original_filename text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'partial')),
  settings_json jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists jobs_user_id_idx on jobs(user_id);
create index if not exists jobs_created_at_idx on jobs(created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- outputs
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists outputs (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references jobs(id) on delete cascade,
  format_name text not null,
  width integer not null,
  height integer not null,
  variant_name text not null,
  mode text not null,
  output_url text,
  prompt_used text,
  status text not null default 'pending'
    check (status in ('pending', 'generating', 'done', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists outputs_job_id_idx on outputs(job_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- masks (optional — used when product isolation is enabled)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists masks (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references jobs(id) on delete cascade,
  mask_url text not null,
  cutout_url text not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- generation_logs
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists generation_logs (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references jobs(id) on delete cascade,
  provider text not null,
  request_type text not null,
  status text not null check (status in ('success', 'error')),
  error_message text,
  metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists gen_logs_job_id_idx on generation_logs(job_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security (RLS)
-- Users can only access their own data.
-- ─────────────────────────────────────────────────────────────────────────────

alter table jobs enable row level security;
alter table outputs enable row level security;
alter table masks enable row level security;
alter table generation_logs enable row level security;

-- jobs: users see their own rows only
create policy "Users can view own jobs"
  on jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert own jobs"
  on jobs for insert
  with check (auth.uid() = user_id);

-- outputs: inherit via job ownership
create policy "Users can view outputs of own jobs"
  on outputs for select
  using (
    exists (
      select 1 from jobs where jobs.id = outputs.job_id and jobs.user_id = auth.uid()
    )
  );

-- masks
create policy "Users can view masks of own jobs"
  on masks for select
  using (
    exists (
      select 1 from jobs where jobs.id = masks.job_id and jobs.user_id = auth.uid()
    )
  );

-- generation_logs
create policy "Users can view logs of own jobs"
  on generation_logs for select
  using (
    exists (
      select 1 from jobs where jobs.id = generation_logs.job_id and jobs.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage buckets
-- Create these manually in Supabase Storage dashboard or via CLI:
--   - uploads    (private)
--   - outputs    (public)
-- ─────────────────────────────────────────────────────────────────────────────
