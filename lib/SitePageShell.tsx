import Link from "next/link";
import type { ReactNode } from "react";

// Shared frame for the small public "company" pages (About, Pricing,
// Privacy, Terms): the marketing nav, a title block, the content, and the
// footer with links to all four. These pages must also be listed in
// MARKETING_PAGES (middleware.ts) and app/sitemap.ts.

export const CONTACT_EMAIL = "hello@groundtruthestimator.com";
export const LINKEDIN_URL = "https://www.linkedin.com/company/ground-truth-estimator/";

export function SiteFooterLinks() {
  return (
    <nav className="landing-foot-links" aria-label="Company">
      <Link href="/about">About</Link>
      <Link href="/pricing">Pricing</Link>
      <Link href="/privacy">Privacy</Link>
      <Link href="/terms">Terms</Link>
      <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer">LinkedIn</a>
      <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
    </nav>
  );
}

export default function SitePageShell({
  eyebrow,
  title,
  lead,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="landing">
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
        <p className="landing-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {lead && <p className="landing-lead">{lead}</p>}
        {updated && <p className="landing-fineprint">Last updated {updated}</p>}
      </section>

      <article className="landing-article" style={{ paddingBottom: 56 }}>
        {children}
      </article>

      <SiteFooterLinks />
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
