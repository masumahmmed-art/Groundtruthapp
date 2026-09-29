import type { Metadata } from "next";
import Link from "next/link";

const URL = "https://www.groundtruthestimator.com/drawing-takeoff";

export const metadata: Metadata = {
  title: "PDF Drawing Takeoff Software for Civil Estimating — Free | Ground Truth Estimator",
  description:
    "Measure lengths, areas, and counts straight off PDF drawings, with a scale for every page and a live running total — then send each quantity into a first-principles estimate. Your drawings stay on your computer.",
  alternates: { canonical: URL },
  openGraph: {
    title: "PDF Drawing Takeoff Software for Civil Estimating",
    description:
      "Quantity takeoff from PDF drawings that feeds straight into a first-principles build-up — with a scale for every page, and drawings that never leave your computer.",
    url: URL,
    siteName: "Ground Truth Estimator",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PDF Drawing Takeoff Software for Civil Estimating",
    description:
      "Quantity takeoff from PDF drawings that feeds straight into a first-principles build-up — with a scale for every page, and drawings that never leave your computer.",
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
    "PDF drawing takeoff for civil infrastructure estimating: measure lengths, areas, and counts off calibrated drawings and send each quantity into a first-principles bill of quantities.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free during early access",
  },
};

export default function DrawingTakeoffPage() {
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
        <p className="landing-eyebrow">PDF drawing takeoff for civil estimating</p>
        <h1>Take quantities off the drawing, straight into the estimate</h1>
        <p className="landing-lead">
          Measure lengths, areas, and counts on your PDF or DXF drawings — with a scale for every
          page and a live running total — then send each quantity into a first-principles
          bill of quantities, ready for its rate to be built up.
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
          Free during early access — no credit card required. Your drawings stay on your
          computer.
        </p>
      </section>

      <article className="landing-article">
        <h2>Why the quantity matters as much as the rate</h2>
        <p>
          A carefully built-up rate multiplied by the wrong quantity is still the wrong
          price. Yet quantities are often scaled off a printout with a ruler, typed into a
          spreadsheet, and never connected back to the drawing they came from. Takeoff in
          Ground Truth Estimator keeps every quantity tied to the drawing and page it was
          measured on, and carries it straight into the estimate.
        </p>

        <h2>A scale for every page</h2>
        <p>
          Calibrate each page by clicking two points a known distance apart — the scale bar
          in the title block is ideal — and typing the real-world distance. Sheets in a
          drawing set are often drawn at different scales, so every page keeps its own; when
          a page shares another page&apos;s scale, reuse it in one click. Zoom in up to 800%,
          or go full screen, and fine-tune any point with the arrow keys, so the scale is
          set precisely rather than approximately.
        </p>

        <h2>Lengths, areas, and counts — with a running total</h2>
        <p>
          Trace a kerb line, a pipe run, or a fence as a length; outline a pad, a car park,
          or a laydown area as an area of any shape; click pits, poles, or trees to count
          them. A live running total shows the quantity as you click, so you can check a
          measurement before you save it — and each point can be nudged or undone without
          starting again.
        </p>

        <h2>From measurement to line item in one step</h2>
        <p>
          Send any measurement to the estimate: pick the category, confirm the description
          and quantity, and it becomes a bill-of-quantities line item with the right unit,
          ready to build its rate up from labour, plant, material, and subcontract in your
          own rate library. The measurement stays marked as sent, so nothing is counted
          twice.
        </p>

        <h2>Your drawings stay on your computer</h2>
        <p>
          The PDF itself is never uploaded. Only its measurements, scales, and a fingerprint
          that identifies that exact file are saved online. Open the drawing on another
          computer — or share it with a colleague — and the app checks it&apos;s the same file
          before showing the measurements, so quantities can never land on the wrong
          revision.
        </p>
      </article>

      <section className="landing-band">
        <h2>One account per company.</h2>
        <p>
          Set up your workspace, bring in your rates, and take off your next project&apos;s
          quantities straight into an estimate you can defend.
        </p>
        <Link href="/signup" className="btn btn-primary">
          Start estimating
        </Link>
      </section>

      <nav className="landing-foot-links" aria-label="Learn more">
        <Link href="/cost-estimating-software">Cost estimating software</Link>
        <Link href="/risk-register">Risk register &amp; contingency</Link>
        <Link href="/earned-value-management">Earned value management</Link>
        <a href="/GroundTruthEstimatorUserGuide.pdf">User guide (PDF)</a>
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
