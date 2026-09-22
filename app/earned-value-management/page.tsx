import type { Metadata } from "next";
import Link from "next/link";

const URL = "https://www.groundtruthestimator.com/earned-value-management";

export const metadata: Metadata = {
  title: "Earned Value Management (EVM) Software for Construction | Ground Truth Estimator",
  description:
    "Track Earned Value and Actual Cost against your original estimate as work happens — using the same Rate Library and Programme, not a separate spreadsheet.",
  alternates: { canonical: URL },
  openGraph: {
    title: "Earned Value Management (EVM) Software for Construction",
    description:
      "Cost control that picks up where the estimate left off — Earned Value and Actual Cost tracked against the same numbers you tendered with.",
    url: URL,
    siteName: "Ground Truth Estimator",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Earned Value Management (EVM) Software for Construction",
    description:
      "Cost control that picks up where the estimate left off — Earned Value and Actual Cost tracked against the same numbers you tendered with.",
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
    "Earned value management software for civil infrastructure projects. Schedule categories on a Programme, log real Labour, Plant, Material, and Subcontract cost, and track Earned Value and Actual Cost against the original estimate.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free during early access",
  },
};

export default function EarnedValueManagementPage() {
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
        <p className="landing-eyebrow">Earned value management for civil infrastructure</p>
        <h1>Earned value tracking that starts from the estimate you already built</h1>
        <p className="landing-lead">
          Log real Labour, Plant, Material, and Subcontract cost against the same Rate
          Library used in the estimate, record % complete as work happens, and see Earned
          Value and Actual Cost — cost control that picks up where the estimate left off,
          not a separate spreadsheet.
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
        <h2>What earned value management is</h2>
        <p>
          Earned value management compares three numbers as a project runs: what you
          planned to spend by this point, what the work completed so far is actually
          worth against that plan, and what you&apos;ve really spent. Tracked separately —
          often in a spreadsheet built after the fact — those three numbers are hard to
          keep honest. Tracked against the same estimate the job was tendered on, they
          tell you early whether a project is on track, without waiting for the final
          reconciliation to find out.
        </p>

        <h2>Why EVM usually lives in a disconnected spreadsheet</h2>
        <p>
          The estimate is built in one tool. The programme is scheduled in another. Actual
          costs get logged in a third, often re-keyed from invoices and timesheets by
          hand. By the time all three are pulled together to check progress, the numbers
          have usually drifted — different rate assumptions, different category
          breakdowns, no shared source of truth.
        </p>

        <h2>How Ground Truth Estimator keeps it connected</h2>
        <p>
          Programme &amp; Positions — give each category a planned start and end date,
          link one category&apos;s finish to another&apos;s the way Microsoft Project&apos;s
          Predecessor field does, and register every site or support role&apos;s Wage or
          Salaried rate, ready to compare against real cost.
        </p>
        <p>
          Actuals &amp; Earned Value — log real Labour, Plant, Material, and Subcontract
          cost against the same Rate Library used in the original estimate, record %
          complete as work happens, and see Earned Value and Actual Cost calculated from
          numbers that were never re-entered or reconciled by hand.
        </p>
        <p>
          Because the estimate, the programme, and the actuals share one Rate Library and
          one category structure, the number you defended at tender keeps being checked
          against the job — automatically, not at the end of the project when it&apos;s too
          late to act on what it shows.
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
        <Link href="/risk-register">Risk register &amp; contingency</Link>
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
