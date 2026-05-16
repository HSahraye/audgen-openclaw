import type { MetadataRoute } from "next";
import { getPublicBaseUrl } from "@/lib/url";

/**
 * Sitemap restricted to public, indexable surfaces. Private dashboards and
 * customer-specific audit pages are intentionally excluded — they're either
 * session-protected or token-gated and not appropriate for search engines.
 *
 * If we add more marketing pages later (pricing, case studies, blog), add
 * them here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getPublicBaseUrl();
  const lastModified = new Date();
  return [
    {
      url: `${base}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/about`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
