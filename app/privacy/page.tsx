import type { Metadata } from "next";
import Link from "next/link";
import SitePageShell, { CONTACT_EMAIL } from "@/lib/SitePageShell";

const URL = "https://www.groundtruthestimator.com/privacy";

export const metadata: Metadata = {
  title: "Privacy Policy | Ground Truth Estimator",
  description: "What Ground Truth Estimator collects, why, where it's stored, and who it's shared with.",
  alternates: { canonical: URL },
};

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

export default function PrivacyPage() {
  return (
    <SitePageShell
      eyebrow="Privacy"
      title="Privacy policy"
      lead="What Ground Truth Estimator collects, why, where it's kept, and who it's shared with."
      updated="17 October 2026"
    >
      <h2>Who we are</h2>
      <p>
        Ground Truth Estimator (&quot;we&quot;, &quot;us&quot;) is an Australian business providing the software at
        groundtruthestimator.com. For anything about your information, email {mail}.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your email address and a password (stored only as a secure hash). If a
          colleague invites you, their invitation includes your email address.
        </li>
        <li>
          <strong>Workspace content:</strong> what you and your team enter: projects, rates, estimates, risks,
          programmes, actual costs, progress, and supplier details such as names and ABNs.
        </li>
        <li>
          <strong>Supplier invoices you upload:</strong> the file and the details read from it.
        </li>
        <li>
          <strong>Drawings:</strong> drawing files stay on your own computer and are not uploaded. We store only each
          drawing&apos;s name, size, a fingerprint used to recognise the same file later, its scales and your
          measurements. (A few drawings added in the app's earliest version are still held online until moved to your computer.)
        </li>
        <li>
          <strong>Feedback</strong> you send from inside the app, with your email address.
        </li>
        <li>
          <strong>Usage information:</strong> pages visited, device and browser type, and how you arrived at the
          site, collected through Google Analytics and our own cookie (below).
        </li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To run the service: sign you in, keep your workspace, and show it only to members of your organisation</li>
        <li>To provide features you ask for, such as site risk lookups and AI invoice reading</li>
        <li>To answer feedback and support requests, and to tell you about important changes to the service</li>
        <li>To understand which pages and features are used, so we can improve them</li>
        <li>To keep the service secure and prevent automated abuse</li>
      </ul>
      <p>We don&apos;t sell your information, and we don&apos;t use your workspace content for advertising.</p>

      <h2>Who we share it with</h2>
      <p>We use these service providers, each only for the purpose listed:</p>
      <ul>
        <li><strong>Supabase:</strong> database, sign-in and file storage for workspace content and supplier invoices</li>
        <li><strong>Vercel:</strong> hosting for the website and app</li>
        <li>
          <strong>Anthropic:</strong> reads uploaded supplier invoices with its Claude AI model to extract invoice
          details, only when you upload an invoice for reading
        </li>
        <li><strong>Cloudflare Turnstile:</strong> checks that sign-ups come from people, not bots</li>
        <li><strong>Google Analytics:</strong> website usage statistics</li>
        <li><strong>Resend:</strong> delivers a copy of in-app feedback to us by email</li>
        <li>
          <strong>Public data services for risk and supplier lookups:</strong> when you run a lookup, the site location
          you entered is sent to services such as Open-Meteo (weather), CSIRO and Geoscience Australia (soils and
          geology), USGS and FEMA (seismic and flood), and the Australian Business Register for ABN checks. These
          lookups don&apos;t include your name or email.
        </li>
      </ul>
      <p>
        Some of these providers store or process information outside Australia, including in the United States. We
        choose providers with appropriate security and only share what each needs.
      </p>

      <h2>Cookies</h2>
      <ul>
        <li>Sign-in cookies, which keep you logged in. The app doesn&apos;t work without them.</li>
        <li>A first-visit cookie (<code>gt_src</code>) that remembers how you first found the site, kept for 90 days.</li>
        <li>Google Analytics cookies, which measure site usage.</li>
      </ul>

      <h2>Keeping and deleting your information</h2>
      <p>
        Workspace content is kept while your workspace is active. To delete your account or your company&apos;s
        workspace, email {mail} and we&apos;ll remove it, apart from anything we must keep by law.
      </p>

      <h2>Accessing or correcting your information</h2>
      <p>
        You can see and edit most of your information in the app. For a copy of what we hold about you, or to correct
        something you can&apos;t change yourself, email {mail}.
      </p>

      <h2>Security</h2>
      <p>
        Information is encrypted in transit, each workspace is separated from every other by database access rules,
        and passwords are never stored in readable form. No system is perfectly secure; if a breach affected your
        information, we would tell you.
      </p>

      <h2>Complaints</h2>
      <p>
        Email {mail} and we&apos;ll respond within 30 days. If you&apos;re not satisfied with our response, you can
        contact the Office of the Australian Information Commissioner at{" "}
        <a href="https://www.oaic.gov.au">oaic.gov.au</a>.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes, the date at the top will change. We&apos;ll tell account holders by email about any
        significant change. See also our <Link href="/terms">terms of use</Link>.
      </p>
    </SitePageShell>
  );
}
