import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Ground Truth Estimator — Cost Estimating & Cost Control for Civil Infrastructure",
  description:
    "Cost estimating and cost control for civil infrastructure — real rates, actual costs, and earned value in one place. Free during early access.",
  openGraph: {
    title: "Ground Truth Estimator — Cost Estimating & Cost Control",
    description:
      "First-principles cost estimating and cost control for civil infrastructure projects, worldwide — real rates, actual costs, and earned value in one place.",
    url: "https://www.groundtruthestimator.com",
    siteName: "Ground Truth Estimator",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ground Truth Estimator — Cost Estimating & Cost Control",
    description:
      "First-principles cost estimating and cost control for civil infrastructure projects, worldwide — real rates, actual costs, and earned value in one place.",
  },
};

// Structured data so search engines (and AI answer engines) understand
// exactly what this is, rather than inferring it from marketing prose.
// Update the "offers.price" field if/when this stops being free.
const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Ground Truth Estimator",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://www.groundtruthestimator.com",
  description:
    "First-principles cost estimating and cost control for civil infrastructure projects, worldwide. Build labour, plant, and material rates into transparent build-ups, then track actual costs and earned value against the plan — backed by an itemised risk register and a risk-adjusted price range.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free during early access",
  },
};

// Logged-in users skip the marketing page and go straight to work.
// Everyone else sees an explainer before being asked to sign up.
export default async function RootPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div className="landing">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <header className="landing-nav">
        <div className="landing-nav-brand">
          <span className="mark">GT</span>
          <span className="landing-nav-name">Ground Truth Estimator</span>
        </div>
        <nav className="landing-nav-links">
          <Link href="/login">Log in</Link>
          <Link href="/signup" className="btn btn-primary btn-sm">
            Create workspace
          </Link>
        </nav>
      </header>

      <section className="landing-hero">
        <p className="landing-eyebrow">First-principles cost estimating and cost control for civil infrastructure</p>
        <h1>
          Build estimates from the ground up — not from a gut-feel per-metre rate.
        </h1>
        <p className="landing-lead">
          Ground Truth Estimator is a workspace for civil contractors and quantity
          surveyors who need to defend a number, not just state one. Labour, plant, and
          material rates assemble into build-ups, roll up into categories, and get
          stress-tested against a real risk register — not a single figure pulled from
          memory.
        </p>
        <p className="landing-lead">
          Most estimating software gives you one blended total and asks you to trust
          it. This shows the math behind every rate, and a best-case / expected /
          worst-case price range generated from your own risk register — not a
          contingency percentage picked to feel safe.
        </p>
        <p className="landing-lead">
          Once work starts, the same numbers keep working: schedule categories on a
          Programme, log real Labour, Plant, Material, and Subcontract cost as it
          happens, and see Earned Value against the plan — cost control that picks up
          where the estimate left off, not a separate spreadsheet.
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
        <p className="landing-fineprint">
          One workspace per company. Your rates and projects are never visible to
          anyone outside your organisation.
        </p>
      </section>

      <section className="landing-features">
        <div className="feature-card" style={{ borderTopColor: "var(--cat-earth)" }}>
          <span className="feature-tag" style={{ color: "var(--cat-earth)" }}>
            Rate library
          </span>
          <h3>Your own rates, reused everywhere</h3>
          <p>
            Build a labour, plant, and material rate library once. Every new project
            draws from the same source, so estimates stay consistent as your
            business&apos;s real costs change.
          </p>
        </div>

        <div className="feature-card" style={{ borderTopColor: "var(--cat-pave)" }}>
          <span className="feature-tag" style={{ color: "var(--cat-pave)" }}>
            Build-up estimating
          </span>
          <h3>Costs built from first principles</h3>
          <p>
            Every line item is assembled from its actual labour, plant, and material
            components — not typed in as a lump sum you can&apos;t defend later.
          </p>
        </div>

        <div className="feature-card" style={{ borderTopColor: "var(--cat-drain)" }}>
          <span className="feature-tag" style={{ color: "var(--cat-drain)" }}>
            Risk register
          </span>
          <h3>Contingency you can point to</h3>
          <p>
            Track project-level risk items alongside the estimate itself — with live
            geotechnical and weather lookups for your site — so contingency is a
            considered number, not a round-up at the end.
          </p>
        </div>

        <div className="feature-card" style={{ borderTopColor: "var(--cat-struct)" }}>
          <span className="feature-tag" style={{ color: "var(--cat-struct)" }}>
            Cost breakdown
          </span>
          <h3>See where the number comes from</h3>
          <p>
            A stacked breakdown of labour, plant, material, and markup for every
            project, so you can explain and defend a price at a glance.
          </p>
        </div>

        <div className="feature-card" style={{ borderTopColor: "var(--warning)" }}>
          <span className="feature-tag" style={{ color: "var(--warning)" }}>
            Risk-adjusted price range
          </span>
          <h3>A range you can defend, not a guess</h3>
          <p>
            Every risk in the register feeds a simulation of thousands of possible
            outcomes, giving you a best case, an expected case, and a worst case — a
            credible range for a client or tender panel, not one number that quietly
            hides the uncertainty.
          </p>
        </div>

        <div className="feature-card" style={{ borderTopColor: "var(--cat-earth)" }}>
          <span className="feature-tag" style={{ color: "var(--cat-earth)" }}>
            Programme &amp; Positions
          </span>
          <h3>Schedule the work, register who&apos;s running it</h3>
          <p>
            Give each category a planned start and end date — link one to another&apos;s
            finish the way Microsoft Project&apos;s Predecessor field does — and register
            every site or support role&apos;s Wage or Salaried rate, ready to compare
            against real cost.
          </p>
        </div>

        <div className="feature-card" style={{ borderTopColor: "var(--cat-pave)" }}>
          <span className="feature-tag" style={{ color: "var(--cat-pave)" }}>
            Actuals &amp; Earned Value
          </span>
          <h3>Track real cost and progress, not just the estimate</h3>
          <p>
            Log real Labour, Plant, Material, and Subcontract cost against the same
            Rate Library used in the estimate, record % complete as work happens, and
            see Earned Value and Actual Cost — so the number you defended at tender
            keeps being checked against the job.
          </p>
        </div>
      </section>

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

      <footer className="landing-foot">
        <div className="landing-nav-brand">
          <span className="mark">GT</span>
          <span className="landing-nav-name">Ground Truth Estimator</span>
        </div>
        <p className="landing-fineprint">Cost estimating and cost control for civil infrastructure projects.</p>
      </footer>
    </div>
  );
}
