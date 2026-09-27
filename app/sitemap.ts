import type { MetadataRoute } from "next";

// The small set of public, indexable pages. The dashboard itself is
// login-gated and has nothing for a crawler to see, so it's deliberately
// left out — same reasoning as robots.ts. Every page listed here must also
// be public in middleware.ts (MARKETING_PAGES), or crawlers are redirected
// to /login.
//
// lastModified is the date the page's content last changed — update it when
// you edit a page. (A date of "now" on every request tells search engines
// nothing, so they learn to ignore it.)

const SITE = "https://www.groundtruthestimator.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, lastModified: "2026-09-27", changeFrequency: "monthly", priority: 1 },
    { url: `${SITE}/cost-estimating-software`, lastModified: "2026-09-27", changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/drawing-takeoff`, lastModified: "2026-09-27", changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/risk-register`, lastModified: "2026-09-27", changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/earned-value-management`, lastModified: "2026-09-27", changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/GroundTruthEstimatorUserGuide.pdf`, lastModified: "2026-09-27", changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/signup`, lastModified: "2026-09-10", changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE}/login`, lastModified: "2026-09-26", changeFrequency: "yearly", priority: 0.3 },
  ];
}
