import type { MetadataRoute } from "next";
import { getAppOrigin } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const origin = getAppOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin/"],
    },
    sitemap: origin ? `${origin}/sitemap.xml` : undefined,
  };
}
