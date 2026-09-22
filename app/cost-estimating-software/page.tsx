import type { Metadata } from "next";
import Link from "next/link";

const URL = "https://www.groundtruthestimator.com/cost-estimating-software";

export const metadata: Metadata = {
  title:
    "Cost Estimating Software for Civil Contractors & Quantity Surveyors | Ground Truth Estimator",
  description:
    "Build-up cost estimating software for civil infrastructure contractors and QS teams — labour, plant, and material rates assembled into a number you can defend, not a gut-feel per-metre figure.",
  alternates: { canonical: URL },
  openGraph: {
    title: "Cost Estimating Software for Civil Contractors & Quantity Surveyors",
    description:
      "Build-up cost estimating software for civil infrastructure contractors and QS teams — a number you can defend, not a gut-feel per-metre figure.",
    url: URL,
    siteName: "Ground Truth Estimator",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cost Estimating Software for Civil Contractors & Quantity Surveyors",
    description:
      "Build-up cost estimating software for civil infrastructure contractors and QS teams — a number you can defend, not a gut-feel per-metre figure.",
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
    "Cost estimating software for civil infrastructure contractors and quantity surveyors. Build labour, plant, and material rates into transparent build-ups, then track actual costs and earned value against the plan.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free during early access",
  },
};

export default function CostEstimatingSoftwarePage() {
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
        <p className="landing-eyebrow">Cost estimating software for civil infrastructure</p>
        <h1>Cost estimating software built for civil contractors and quantity surveyors</h1>
        <p className="landing-lead">
          A workspace for teams who need to defend a number, not just state one. Labour,
          plant, and material rates assemble into build-ups, roll up into categories, and
          get stress-tested against a real risk register — not a single figure pulled from
          memory.
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
        <h2>Why civil contractors and QS teams outgrow spreadsheets</h2>
        <p>
          A spreadsheet estimate can price a job, but it can rarely explain one. Once a
          rate gets typed in as a lump sum, the reasoning behind it — which labour crew,
          which plant hire rate, which material supplier quote — is gone the moment
          someone else opens the file, or the moment you open it again six months later on
          the next tender. Cost estimating software built specifically for civil
          infrastructure work keeps that reasoning attached to the number, so a build-up
          from last year is still a build-up you can check, adjust, and reuse.
        </p>
        <p>
          Ground Truth Estimator is built around that idea: every estimate is assembled
          from first principles — labour, plant, and material rates you maintain once and
          reuse on every project — rather than typed in as a total you can&apos;t
          reconstruct later.
        </p>

        <h2>How build-up estimating works</h2>
        <p>
          Instead of entering one blended rate per line item, each item is built from its
          actual components:
        </p>
        <ul>
          <li>
            <strong>Labour</strong> — crew composition and wage or salaried rates
          </li>
          <li>
            <strong>Plant</strong> — hire or ownership rates for the equipment the item
            actually needs
          </li>
          <li>
            <strong>Material</strong> — supplier rates for what the item consumes
          </li>
        </ul>
        <p>
          Those build-ups roll up into categories, and categories roll up into the project
          total — with a stacked breakdown of labour, plant, material, and markup visible
          at every level, so you can explain and defend a price at a glance instead of
          reverse-engineering it under pressure in a tender review.
        </p>

        <h2>A rate library you build once and reuse everywhere</h2>
        <p>
          Labour, plant, and material rates live in a single library scoped to your
          company. Every new project draws from the same source, so estimates stay
          consistent as your business&apos;s real costs change — update a rate once, and
          every future build-up that uses it is current, rather than hunting through old
          spreadsheets to see which version of a rate was actually used.
        </p>

        <h2>Cost control doesn&apos;t stop at the estimate</h2>
        <p>
          Once work starts, the same numbers keep working: schedule categories on a
          Programme, log real Labour, Plant, Material, and Subcontract cost as it happens,
          and see Earned Value against the plan — cost control that picks up where the
          estimate left off, in the same workspace, rather than a separate spreadsheet
          that quietly drifts out of sync.
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
        <Link href="/risk-register">Risk register &amp; contingency</Link>
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
