import type { Metadata } from "next";
import Link from "next/link";
import SitePageShell, { CONTACT_EMAIL } from "@/lib/SitePageShell";

const URL = "https://www.groundtruthestimator.com/terms";

export const metadata: Metadata = {
  title: "Terms of Use | Ground Truth Estimator",
  description: "The terms for using Ground Truth Estimator during early access.",
  alternates: { canonical: URL },
};

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

export default function TermsPage() {
  return (
    <SitePageShell
      eyebrow="Terms"
      title="Terms of use"
      lead="The terms for using Ground Truth Estimator. By creating a workspace or using the service, you agree to them."
      updated="17 October 2026"
    >
      <h2>The service</h2>
      <p>
        Ground Truth Estimator is cost estimating and cost control software provided by an Australian business
        (&quot;we&quot;, &quot;us&quot;). It is in early access: it&apos;s free to use, it&apos;s still changing,
        and features may be added, changed or removed.
      </p>

      <h2>Your account and workspace</h2>
      <ul>
        <li>Keep your sign-in details secure; you&apos;re responsible for activity under your account.</li>
        <li>
          Whoever creates a workspace manages it for their organisation, including who is invited and who can
          approve invoices.
        </li>
        <li>Use the service lawfully, and don&apos;t try to access other organisations&apos; workspaces or disrupt the service.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        Your rates, projects, drawings and other content remain yours. You give us permission to store and process
        them only as needed to run the service for you, as described in the{" "}
        <Link href="/privacy">privacy policy</Link>. Only upload content you have the right to use.
      </p>

      <h2>Estimates and professional judgement</h2>
      <p>
        Ground Truth Estimator is a tool to support your work, not a substitute for professional judgement. Estimates,
        risk-adjusted ranges, site risk lookups, takeoff measurements and AI-read invoice details depend on the
        information entered and on outside data sources, and can be wrong. Check results before relying on them,
        including every AI-read invoice before you approve it, and before submitting a price, tender or claim.
      </p>

      <h2>Pricing</h2>
      <p>
        The service is free during early access, within the limits shown on the <Link href="/pricing">pricing</Link>{" "}
        page. If paid plans are introduced, we&apos;ll give notice before anything is charged, and nothing will be
        charged without your agreement.
      </p>

      <h2>Availability</h2>
      <p>
        We aim to keep the service available and your data safe, but we don&apos;t guarantee uninterrupted access.
        Keep your own copies of anything critical, such as exported estimates and source drawings. If we ever
        discontinue the service, we&apos;ll give reasonable notice so you can export your data.
      </p>

      <h2>Liability</h2>
      <p>
        Nothing in these terms excludes rights you have under the Australian Consumer Law that can&apos;t be
        excluded. Otherwise, to the extent the law allows, the service is provided as-is, and we&apos;re not liable
        for indirect or consequential loss, such as lost profit or a lost tender, arising from use of the service.
      </p>

      <h2>Ending use</h2>
      <p>
        You can stop using the service at any time and ask us to delete your workspace. We may suspend access that
        breaches these terms or puts the service or other users at risk.
      </p>

      <h2>Changes and contact</h2>
      <p>
        If these terms change, the date at the top will change, and we&apos;ll tell account holders by email about
        significant changes. These terms are governed by the laws of Australia. Questions: {mail}.
      </p>
    </SitePageShell>
  );
}
