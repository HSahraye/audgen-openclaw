import type { MetadataRoute } from "next";
import { getAppOrigin } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getAppOrigin() || "http://localhost:3000";
  const now = new Date();
  return [
    { url: `${origin}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${origin}/leadgen`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${origin}/onboarding`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${origin}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${origin}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
