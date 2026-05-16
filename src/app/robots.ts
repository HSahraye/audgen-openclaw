import type { MetadataRoute } from "next";
import { getPublicBaseUrl } from "@/lib/url";

/**
 * robots.txt for the deployed app.
 *
 * The app is primarily an internal sales-engine surface — every dashboard
 * route requires a session. The only routes intended for indexing are the
 * marketing landing page (/) and /about. Public audit pages (/audit/[id],
 * /a/[slug]) are token-protected and shared 1:1 with prospects; we don't
 * want them in search results, which would also leak business names.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/about"],
        disallow: [
          "/api/",
          "/admin",
          "/admin/",
          "/audit/",
          "/a/",
          "/prep/",
          "/sequences",
          "/sequences/",
          "/outreach",
          "/brief",
          "/call-today",
          "/research",
          "/templates",
          "/onboarding",
          "/settings",
          "/automation",
          "/login",
          "/accept-invite",
        ],
      },
    ],
    sitemap: `${getPublicBaseUrl()}/sitemap.xml`,
  };
}
