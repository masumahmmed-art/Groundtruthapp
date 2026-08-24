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
            <b>✨ Ask AI</b> (the search box at the top) answers open-ended pricing questions by
            searching the web live — e.g. "concrete supply rate in Texas" — and shows its
            sources.
          </p>
          <p>
            <b>✨ AI</b> (the button on each rate row) does the same search but tailored to that
            specific rate: it proposes a rate and unit you can review and, if it looks right,
            apply with one click. Nothing is ever applied automatically — you always choose to
            accept a suggestion.
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
