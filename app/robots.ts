import type { MetadataRoute } from "next";

// Lets search engines crawl the public marketing/auth pages, keeps them out
// of the logged-in dashboard (which is behind auth anyway and has nothing
// for a crawler to index), and points them at the sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api"],
    },
    sitemap: "https://groundtruthestimator.com/sitemap.xml",
  };
}
