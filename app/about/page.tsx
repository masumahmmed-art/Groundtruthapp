import type { Metadata } from "next";
import Link from "next/link";
import SitePageShell, { CONTACT_EMAIL } from "@/lib/SitePageShell";

const URL = "https://www.groundtruthestimator.com/about";

export const metadata: Metadata = {
  title: "About | Ground Truth Estimator",
  description:
    "Ground Truth Estimator is cost estimating and cost control software for civil infrastructure contractors and quantity surveyors, built in Australia.",
  alternates: { canonical: URL },
};

export default function AboutPage() {
  return (
    <SitePageShell
      eyebrow="About"
      title="Estimates you can defend, and cost control that follows them"
      lead="Ground Truth Estimator is cost estimating and cost control software for civil infrastructure contractors and quantity surveyors. It's an independent product, built in Australia."
    >
      <h2>Why it exists</h2>
      <p>
        Most civil estimates still end in one blended total: a per-metre rate from memory, plus a contingency
        percentage picked to feel safe. That number is hard to defend to a client or a tender panel, and once work
        starts it usually lives in a separate spreadsheet from the costs actually being spent.
      </p>
      <p>
        Ground Truth Estimator builds every rate from its labour, plant and material components, prices risk from a
        real risk register instead of a flat percentage, and carries the same numbers through to actual cost and
        earned value once the job is running.
      </p>

      <h2>Who it&apos;s for</h2>
      <ul>
        <li>Civil contractors pricing roads, drainage, earthworks, structures and utilities work</li>
        <li>Quantity surveyors and cost estimators who need to show how a number was built</li>
        <li>Project teams tracking actual cost and progress against the estimate</li>
      </ul>

      <h2>Where it&apos;s at</h2>
      <p>
        Ground Truth Estimator is in early access and free to use while it&apos;s shaped by its first users. See{" "}
        <Link href="/pricing">pricing</Link> for what&apos;s included.
      </p>

      <h2>Your data</h2>
      <p>
        Each company gets its own private workspace: your rates, projects and costs are never visible to anyone
        outside your organisation. Drawings you measure stay on your own computer. The{" "}
        <Link href="/privacy">privacy policy</Link> covers exactly what is stored and where.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, feedback or a demo: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </SitePageShell>
  );
}
