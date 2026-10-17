import type { Metadata } from "next";
import Link from "next/link";
import SitePageShell, { CONTACT_EMAIL } from "@/lib/SitePageShell";

const URL = "https://www.groundtruthestimator.com/pricing";

export const metadata: Metadata = {
  title: "Pricing — Free During Early Access | Ground Truth Estimator",
  description:
    "Ground Truth Estimator is free during early access: estimating, drawing takeoff, risk register, programme, actual cost and earned value, with 20 AI invoice reads per workspace each month.",
  alternates: { canonical: URL },
};

export default function PricingPage() {
  return (
    <SitePageShell
      eyebrow="Pricing"
      title="Free during early access"
      lead="Every feature is included at no cost while Ground Truth Estimator is in early access. No credit card required."
    >
      <h2>What&apos;s included</h2>
      <ul>
        <li>One private workspace for your company, with team invitations</li>
        <li>Unlimited projects and a shared rate library for labour, plant and materials</li>
        <li>First-principles build-up estimating and cost summaries</li>
        <li>Drawing takeoff on PDF and DXF drawings</li>
        <li>Risk register with weather, geotechnical, flood, seismic and market-escalation lookups, and a risk-adjusted price range</li>
        <li>Programme, positions, actual cost tracking and earned value</li>
        <li>Supplier register with ABN validation</li>
        <li>
          Supplier invoice inbox with AI reading: <strong>20 invoice reads per workspace each month</strong>. Past
          that, invoices can still be added and coded by hand.
        </li>
      </ul>

      <h2>After early access</h2>
      <p>
        Paid plans will come later, mainly for higher volumes of AI invoice reading. Nothing will be charged without
        notice first, and early-access workspaces won&apos;t lose the data they&apos;ve built up.
      </p>

      <h2>Questions</h2>
      <p>
        Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, or{" "}
        <Link href="/signup">create a workspace</Link> and try it on a real project.
      </p>
    </SitePageShell>
  );
}
