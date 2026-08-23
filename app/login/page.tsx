import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
        <p className="landing-eyebrow">First-principles cost estimating</p>
        <h1>
          Build estimates from the ground up — not from a gut-feel per-metre rate.
        </h1>
        <p className="landing-lead">
          Ground Truth Estimator is a workspace for Australian civil infrastructure
          companies to price projects the way a good estimator actually does it:
          labour, plant, and material rates assembled into build-ups, rolled up into
          categories, and stress-tested against a real risk register — not a single
          number pulled from memory.
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
            business's real costs change.
          </p>
        </div>
        <div className="feature-card" style={{ borderTopColor: "var(--cat-pave)" }}>
          <span className="feature-tag" style={{ color: "var(--cat-pave)" }}>
            Build-up estimating
          </span>
          <h3>Costs built from first principles</h3>
          <p>
            Every line item is assembled from its actual labour, plant, and material
            components — not typed in as a lump sum you can't defend later.
          </p>
        </div>
        <div className="feature-card" style={{ borderTopColor: "var(--cat-drain)" }}>
          <span className="feature-tag" style={{ color: "var(--cat-drain)" }}>
            Risk register
          </span>
          <h3>Contingency you can point to</h3>
          <p>
            Track project-level risk items alongside the estimate itself, so
            contingency is a considered number — not a round-up at the end.
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
      </section>

      <section className="landing-band">
        <h2>One account per company.</h2>
        <p>
          Set up your workspace, bring in your rates, and start estimating your next
          project the way it should be priced.
        </p>
        <Link href="/signup" className="btn btn-primary">
          Create your workspace
        </Link>
      </section>

      <footer className="landing-foot">
        <span>Ground Truth Estimator</span>
        <span className="landing-foot-dim">
          Cost estimating for Australian civil infrastructure projects.
        </span>
      </footer>
    </div>
  );
}
