import type { Metadata } from "next";
import Link from "next/link";

const URL = "https://www.groundtruthestimator.com/methvin-alternative";

// Comparative page: every statement about Methvin must stay accurate and
// sourced (Australian Consumer Law). Re-check against methvin.org and update
// CHECKED_ON whenever this page is edited.
const CHECKED_ON = "27 September 2026";

export const metadata: Metadata = {
  title: "Methvin Alternative for Civil Estimating — Ground Truth Estimator",
  description:
    "Comparing Ground Truth Estimator and Methvin for civil estimating: first-principles build-ups, drawing takeoff, a probabilistic risk register with site checks, and Earned Value — free with no project limit during early access.",
  alternates: { canonical: URL },
  openGraph: {
    title: "Methvin Alternative for Civil Estimating",
    description:
      "An honest comparison of Ground Truth Estimator and Methvin — what each does best, and which suits a small-to-mid civil contractor.",
    url: URL,
    siteName: "Ground Truth Estimator",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Methvin Alternative for Civil Estimating",
    description:
      "An honest comparison of Ground Truth Estimator and Methvin — what each does best, and which suits a small-to-mid civil contractor.",
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
    "Construction cost estimating and cost control for civil infrastructure: drawing takeoff, first-principles build-ups, a probabilistic risk register with site checks, programme, actuals and Earned Value.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free during early access",
  },
};

const rows: [string, string, string][] = [
  ["Price", "Free during early access, no project limit", "Free plan (estimating limited to 5 projects); paid plans from $79/month"],
  ["Drawing takeoff", "PDF — length, area and count, with a scale for each page", "PDF, DWG and DXF — count, length, area, wall area, volume and end-area, with formulas"],
  ["First-principles build-up", "Labour, plant, material and subcontract from your own rate library", "Yes"],
  ["Risk", "Built in: probabilistic register with 3-point estimates and a simulated price range, plus automatic weather, soil, flood, seismic and market checks for the site", "@RISK (a separate Palisade product) is listed as an integration partner"],
  ["Scheduling", "Programme with predecessors and lag; Primavera P6 import", "Gantt scheduler"],
  ["Cost control", "Actuals ledgers, positions and Earned Value", "Job costing; earned value reports"],
  ["Accounting link", "Not yet", "Xero, SAP and JDE on paid plans"],
];

export default function MethvinAlternativePage() {
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
        <p className="landing-eyebrow">Methvin alternative</p>
        <h1>Looking for a Methvin alternative for civil estimating?</h1>
        <p className="landing-lead">
          Methvin is an established estimating and project management suite. Ground Truth
          Estimator is newer and narrower: first-principles estimating, risk and cost control for
          small-to-mid civil contractors — from drawing takeoff to Earned Value in one tool, free
          to start. Here&apos;s an honest comparison.
        </p>
        <div className="landing-cta">
          <Link href="/signup" className="btn btn-primary">
            Try Ground Truth free
          </Link>
          <a href="/GroundTruthEstimatorUserGuide.pdf" className="btn">
            Read the user guide
          </a>
        </div>
        <p className="landing-fineprint">
          Free during early access — no credit card and no project limit.
        </p>
      </section>

      <article className="landing-article">
        <h2>At a glance</h2>
        <div className="landing-table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: "22%" }}></th>
                <th style={{ width: "39%" }}>Ground Truth Estimator</th>
                <th style={{ width: "39%" }}>Methvin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, gt, mv]) => (
                <tr key={label}>
                  <td>
                    <strong>{label}</strong>
                  </td>
                  <td>{gt}</td>
                  <td>{mv}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 13 }}>
          Methvin details are taken from its own{" "}
          <a href="https://methvin.org/pricing/" rel="nofollow noopener" target="_blank">
            pricing
          </a>
          ,{" "}
          <a
            href="https://methvin.org/products/estimating-tools/takeoff-software/"
            rel="nofollow noopener"
            target="_blank"
          >
            takeoff
          </a>{" "}
          and{" "}
          <a
            href="https://methvin.org/services/integration/integration-partners"
            rel="nofollow noopener"
            target="_blank"
          >
            integration partners
          </a>{" "}
          pages, checked on {CHECKED_ON}. Prices and features change — check Methvin&apos;s site
          for the latest.
        </p>

        <h2>Where Ground Truth Estimator fits better</h2>
        <ul>
          <li>
            <strong>Contingency you can defend, built in.</strong> Every risk has a probability and a
            cost impact — or a min/most-likely/max range — and the register simulates thousands of
            outcomes to give a best, expected and worst-case price, with no separate risk product to
            buy.{" "}
            <Link href="/risk-register">How the risk register works</Link>
          </li>
          <li>
            <strong>Site checks built in.</strong> Enter the site once and get weather, soil,
            flood, seismic and market-escalation checks that suggest risk items for you.
          </li>
          <li>
            <strong>No project limit while it&apos;s free.</strong> Estimate as many jobs as you
            like during early access.
          </li>
          <li>
            <strong>Takeoff to Earned Value in one place.</strong>{" "}
            <Link href="/drawing-takeoff">Measure off the drawing</Link>, build the rate up, price
            the risk, then track actuals and{" "}
            <Link href="/earned-value-management">Earned Value</Link> against the same estimate.
          </li>
          <li>
            <strong>Your drawings stay with you.</strong> PDF drawings are never uploaded — only
            their measurements and scales are saved online.
          </li>
        </ul>

        <h2>On our roadmap</h2>
        <p>
          We build what our users ask for. These are next in line, in the order our users need
          them:
        </p>
        <ul>
          <li>
            <strong>Takeoff straight from CAD files (DWG and DXF),</strong> with points that snap
            to the drawing&apos;s own lines.
          </li>
          <li>
            <strong>Volume, end-area and wall-area measurements,</strong> with formulas for waste
            and compaction factors.
          </li>
          <li>
            <strong>A Xero and MYOB link,</strong> so supplier bills flow into actual costs
            without re-typing.
          </li>
        </ul>
        <p>
          If your team needs one of these, tell us — early adopters can agree pricing with us as
          we build it. <Link href="/signup">Create a free workspace</Link> and use{" "}
          <strong>Feedback</strong> in the app to get in touch.
        </p>
        <p style={{ fontSize: 13 }}>
          Roadmap items are planned, not promised; what we build and when depends on demand.
        </p>

        <h2>Who Ground Truth Estimator is for</h2>
        <p>
          Estimators, QS teams and project managers at small-to-mid civil and infrastructure
          contractors — roads, drainage, earthworks and site works — who want every rate built up
          from first principles, every contingency backed by named risks, and one place to see how
          the job is tracking against its tender.
        </p>
      </article>

      <section className="landing-band">
        <h2>Try it on your next tender.</h2>
        <p>Set up your workspace, bring in your rates, and price your next job — free, with no project limit.</p>
        <Link href="/signup" className="btn btn-primary">
          Start estimating
        </Link>
      </section>

      <nav className="landing-foot-links" aria-label="Learn more">
        <Link href="/cost-estimating-software">Cost estimating software</Link>
        <Link href="/drawing-takeoff">PDF drawing takeoff</Link>
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
          Cost estimating and cost control for civil infrastructure projects. Methvin is a
          trademark of its owner; Ground Truth Estimator is not affiliated with Methvin.
        </p>
      </footer>
    </div>
  );
}
