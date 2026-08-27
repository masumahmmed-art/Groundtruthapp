import type { MetadataRoute } from "next";

// The small set of public, indexable pages. The dashboard itself is
// login-gated and has nothing for a crawler to see, so it's deliberately
// left out — same reasoning as robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://groundtruthestimator.com",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://groundtruthestimator.com/signup",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: "https://groundtruthestimator.com/login",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
