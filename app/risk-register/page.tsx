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
        </p>
      </section>

      <article className="landing-article">
        <h2>Why a flat contingency percentage doesn&apos;t hold up</h2>
        <p>
          Most estimates carry contingency as a single percentage — 10%, 15%, whatever
          feels safe — applied across the board regardless of which parts of the job
          actually carry risk. It&apos;s fast, but it can&apos;t answer the question a client or
          tender panel actually asks: what, specifically, could make this number wrong,
          and by how much? A flat percentage treats every project the same; a real risk
          register doesn&apos;t.
        </p>

        <h2>Building a risk register alongside the estimate</h2>
        <p>
          In Ground Truth Estimator, risk lives next to the numbers it affects. You track
          project-level risk items — the specific things that could drive cost or schedule
          up or down — as part of the same workspace as the build-up itself, with live
          geotechnical and weather lookups for your site pulled in automatically rather
          than researched separately.
        </p>

        <h2>From a risk register to a risk-adjusted price range</h2>
        <p>
          Every risk in the register feeds a simulation of thousands of possible
          outcomes — a Monte Carlo-style approach — rather than one static what-if
          calculation. The result is a best case, an expected case, and a worst case: a
          credible range for a client or tender panel, not one number that quietly hides
          the uncertainty behind it.
        </p>
        <p>
          That range is what a considered contingency actually looks like — a number
          derived from named, specific risks, that you can point to and explain, rather
          than a percentage nobody can defend under questioning.
        </p>

        <h2>Risk that stays connected to the job after tender</h2>
        <p>
          The risk register doesn&apos;t end when the estimate is submitted. As the project
          moves into Programme scheduling and Actuals tracking, the same register stays
          part of the workspace — so the risks you priced at tender remain visible
          against the job as it&apos;s actually delivered.
        </p>
      </article>

      <section className="landing-band">
        <h2>One account per company.</h2>
        <p>
          Set up your workspace, bring in your rates, and start estimating your next
          project with numbers you can actually defend.
        </p>
        <Link href="/signup" className="btn btn-primary">
          Start estimating
        </Link>
      </section>

      <nav className="landing-foot-links" aria-label="Learn more">
        <Link href="/cost-estimating-software">Cost estimating software</Link>
        <Link href="/earned-value-management">Earned value management</Link>
        <Link href="/">Home</Link>
      </nav>
      <footer className="landing-foot">
        <div className="landing-nav-brand">
          <span className="mark">GT</span>
          <span className="landing-nav-name">Ground Truth Estimator</span>
        </div>
        <p className="landing-fineprint">
          Cost estimating and cost control for civil infrastructure projects.
        </p>
      </footer>
    </div>
  );
}
