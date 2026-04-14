// POST /api/preprocess
// Scans an uploaded image for UI artifacts and returns the detected regions.
// Called from the generate page (step 2) so the user can see what will be cleaned.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { downloadFileAsBuffer } from "@/lib/storage";
import { detectArtifactRegions } from "@/lib/ai/gemini-provider";
import type { ArtifactRegion } from "@/types";

function detectMimeType(url: string): string {
  const pathname = url.split("?")[0].toLowerCase();
  if (pathname.endsWith(".png"))  return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { imageUrl } = await req.json() as { imageUrl?: string };
    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }

    const buffer   = await downloadFileAsBuffer(imageUrl);
    const mimeType = detectMimeType(imageUrl);
    const base64   = buffer.toString("base64");

    const regions: ArtifactRegion[] = await detectArtifactRegions(base64, mimeType);

    return NextResponse.json({ regions });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[preprocess]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
