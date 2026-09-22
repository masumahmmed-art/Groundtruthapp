import type { Metadata } from "next";
import Link from "next/link";

const URL = "https://www.groundtruthestimator.com/risk-register";

export const metadata: Metadata = {
  title:
    "Risk Register & Risk-Adjusted Contingency Calculator for Construction | Ground Truth Estimator",
  description:
    "Track project risk alongside your estimate and get a risk-adjusted best-case, expected-case, and worst-case price range from a Monte Carlo-style simulation — not a contingency percentage picked to feel safe.",
  alternates: { canonical: URL },
  openGraph: {
    title: "Risk Register & Risk-Adjusted Contingency Calculator for Construction",
    description:
      "A risk register that produces a defensible, risk-adjusted price range — not a contingency percentage picked to feel safe.",
    url: URL,
    siteName: "Ground Truth Estimator",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Risk Register & Risk-Adjusted Contingency Calculator for Construction",
    description:
      "A risk register that produces a defensible, risk-adjusted price range — not a contingency percentage picked to feel safe.",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Ground Truth Estimator",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: URL,
  description:
    "Risk register and risk-adjusted contingency calculator for civil infrastructure projects. Track project risk items alongside the estimate and simulate a best-case, expected-case, and worst-case price range.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free during early access",
  },
};

export default function RiskRegisterPage() {
  return (
    <div className="landing">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <header className="landing-nav">
        <Link href="/" className="landing-nav-brand" style={{ textDecoration: "none" }}>
          <span className="mark">GT</span>
          <span className="landing-nav-name">Ground Truth Estimator</span>
        </Link>
        <nav className="landing-nav-links">
          <Link href="/login">Log in</Link>
          <Link href="/signup" className="btn btn-primary btn-sm">
            Create workspace
          </Link>
        </nav>
      </header>

      <section className="landing-hero">
        <p className="landing-eyebrow">Risk register for civil infrastructure projects</p>
        <h1>A risk register that produces a range you can defend, not a guess</h1>
        <p className="landing-lead">
          Track project-level risk items alongside the estimate itself — with live
          geotechnical and weather lookups for your site — so contingency is a considered
          number, not a round-up picked at the end to feel safe.
        </p>
        <div className="landing-cta">
          <Link href="/signup" className="btn btn-primary">
            Create your workspace
          </Link>
          <Link href="/login" className="btn">
            Log in
          </Link>
        </div>
        <p className="landing-fineprint">
          Free during early access — no credit card required.
