export default function HelpPage() {
  return (
    <div>
      <div className="titleblock">
        <div>
          <h2>Help & how it works</h2>
          <div className="meta">A quick tour of every part of Ground Truth Estimator.</div>
        </div>
      </div>

      <div className="section">
        <div className="card" style={{ padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ margin: "0 0 4px" }}>📄 Full user guide (PDF)</h3>
            <p style={{ margin: 0 }}>
              A step-by-step manual covering first-principles estimating — the considerations
              behind a sound estimate — and a full walkthrough of using this software from
              setting up your workspace through to exporting a finished estimate.
            </p>
          </div>
          
            href="/GroundTruthEstimatorUserGuide.pdf"
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
            style={{ whiteSpace: "nowrap" }}
          >
            Download the guide
          </a>
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h3>Your workspace</h3></div>
        <div className="card" style={{ padding: "18px 22px" }}>
          <p>
            Every company gets one workspace when the first person signs up. Your Rate Library
            and every project you create are private to your workspace and invisible to anyone
            else on the platform.
          </p>
        </div>
      </div>
      <div className="section">
        <div className="section-head"><h3>Rate Library</h3></div>
        <div className="card" style={{ padding: "18px 22px" }}>
          <p>
            Your workspace's own labour, plant, and material rates, reused across every
            project. Every new workspace starts with indicative rates so it works immediately
            — replace them with your own real supplier quotes and labour agreements before
            relying on this for a real tender.
          </p>
          <p>
            <b>🔎 Search the web</b> (the box at the top, and the button on each rate row) opens
            a normal web search in a new tab so you can quickly check current supplier or hire
            pricing for a rate. It's a plain search shortcut — nothing is fetched or applied
            automatically, you review the results yourself and type in whatever figure you
            decide is right.
          </p>
        </div>
      </div>
      <div className="section">
        <div className="section-head"><h3>Estimate — Bill of Quantities</h3></div>
        <div className="card" style={{ padding: "18px 22px" }}>
          <p>
            Each project is broken into categories (earthworks, pavement, drainage,
            structures, or your own). Inside each category, add line items — click a line item
            to open its build-up.
          </p>
          <p>
            A build-up assembles a line item's unit rate from its actual Labour, Plant, and
            Material components, each pulled from your Rate Library with a "qty per unit" you
            set — not a lump-sum guess. If a column shows "None" and clicking "+ add" does
            nothing, your Rate Library doesn't have any items of that kind yet — add some there
            first.
          </p>
          <p>
            When your workspace's unit system (see Settings) differs from a line item's own
            unit, a small greyed "≈" line shows the converted quantity and rate alongside it —
            the stored numbers themselves never change, only what's shown.
          </p>
        </div>
      </div>
      <div className="section">
        <div className="section-head"><h3>Risk & Location</h3></div>
        <div className="card" style={{ padding: "18px 22px" }}>
          <p>
            An itemised risk register — each risk has a probability and a cost impact, and its
            allowance (probability × impact) feeds into the estimate's total. The weather-risk
            lookup pulls live historical climate data for your site's location and can suggest
            a starting weather risk entry for you to refine.
          </p>
        </div>
      </div>
      <div className="section">
        <div className="section-head"><h3>Summary</h3></div>
        <div className="card" style={{ padding: "18px 22px" }}>
          <p>
            The full cost cascade: Direct cost → Preliminaries → Risk (from the register) →
            Contingency → Overhead → Margin → subtotal → Tax → Contract price (what you'd
            tender) → + Principal's administrative cost → Total project cost. Every percentage
            is editable and recalculates live. Use "Print / Save PDF" for a clean printable
            version, or "Export line items (CSV)" for a spreadsheet of every priced line item.
          </p>
        </div>
      </div>
      <div className="section">
        <div className="section-head"><h3>Settings</h3></div>
        <div className="card" style={{ padding: "18px 22px" }}>
          <p>
            Set your workspace's currency and preferred unit system (Metric or Imperial) on
            the Settings page. Currency changes how every dollar figure is formatted,
            everywhere in the app. Unit system only affects the small converted-equivalent
            hints described above — it never rewrites what you've actually typed.
          </p>
        </div>
      </div>
      <div className="section">
        <div className="section-head"><h3>Your account</h3></div>
        <div className="card" style={{ padding: "18px 22px" }}>
          <p>
            Forgot your password? Use "Forgot password?" on the login page — it emails you a
            link to set a new one. If you try to sign up again with an email that's already
            registered, you'll be told to log in instead rather than getting a confusing silent
            failure.
          </p>
        </div>
      </div>
    </div>
  );
}
