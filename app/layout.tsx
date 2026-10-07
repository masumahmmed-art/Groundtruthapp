import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.groundtruthestimator.com"),
  title: "Ground Truth Estimator",
  description:
    "First-principles cost estimating for civil infrastructure projects, worldwide.",
  // Tells Google which URL is the "real" one when the same page is reachable
  // at more than one address (e.g. the bare apex domain, which redirects
  // here anyway) — fixes "Duplicate without user-selected canonical" in
  // Search Console. Individual pages can override this with their own
  // `alternates.canonical` if needed.
  alternates: {
    canonical: "/",
  },
};

// Google Analytics (gtag.js). Loaded once here in the root layout so every
// page in the app is tracked automatically — no need to add this to each
// page individually the way a plain HTML site would.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-G1N468LQ5Q"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-G1N468LQ5Q');
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
