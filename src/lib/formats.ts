import type { OutputFormat } from "@/types";

export const FORMAT_PRESETS: OutputFormat[] = [
  // Social
  {
    id: "instagram_square",
    label: "Instagram Square",
    width: 1080,
    height: 1080,
    platform: "Instagram",
    aspectRatio: "1:1",
  },
  {
    id: "instagram_portrait",
    label: "Instagram Portrait",
    width: 1080,
    height: 1350,
    platform: "Instagram",
    aspectRatio: "4:5",
  },
  {
    id: "story_reels",
    label: "Story / Reels",
    width: 1080,
    height: 1920,
    platform: "Instagram / TikTok",
    aspectRatio: "9:16",
  },
  {
    id: "facebook_feed",
    label: "Facebook Feed",
    width: 1200,
    height: 628,
    platform: "Facebook",
    aspectRatio: "1.91:1",
  },
  // Display / Web
  {
    id: "hero_banner",
    label: "Hero Banner",
    width: 1920,
    height: 1080,
    platform: "Web",
    aspectRatio: "16:9",
  },
  {
    id: "landscape_ad",
    label: "Landscape Ad",
    width: 1600,
    height: 900,
    platform: "Display",
    aspectRatio: "16:9",
  },
  {
    id: "wide_banner",
    label: "Wide Banner",
    width: 1080,
    height: 566,
    platform: "Display",
    aspectRatio: "1.91:1",
  },
  {
    id: "widescreen_post",
    label: "Widescreen Post",
    width: 1080,
    height: 608,
    platform: "YouTube / LinkedIn",
    aspectRatio: "16:9",
  },
];

export const FORMAT_GROUPS = [
  {
    label: "Social",
    ids: ["instagram_square", "instagram_portrait", "story_reels", "facebook_feed"],
  },
  {
    label: "Display / Web",
    ids: ["hero_banner", "landscape_ad", "wide_banner", "widescreen_post"],
  },
];

export function getFormatById(id: string): OutputFormat | undefined {
  return FORMAT_PRESETS.find((f) => f.id === id);
}
