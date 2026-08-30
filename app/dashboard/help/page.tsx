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
          <a
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
        <div className="card" style={{ padding: "14px 22px" }}>
          <p style={{ margin: 0, fontSize: 13 }}>
            <b>A note on terms:</b> this app uses Australian/UK construction terminology in a
            few places — "Plant" means equipment, a "hire rate" is a rental rate,
            "Preliminaries / Indirect Job Costs" is what's often called General Conditions in
            the US, "tender" means bid, and "Labour" is the British spelling of "Labor." The
            costs and calculations work identically everywhere — only the wording differs.
          </p>
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
            allowance (probability × impact) feeds into the estimate's total. For a risk where
            the cost itself is uncertain (not just whether it happens), the optional <b>Min</b>
            and <b>Max</b> columns let you enter a 3-point estimate instead of a single fixed
            figure — leave them blank for risks you already know the cost of, and use them for
            the few where the range genuinely matters, like unexpected ground conditions.
          </p>
          <p>
            Enter your site location once and use it for two live lookups. The <b>weather risk
            lookup</b> pulls historical climate data for the site and can suggest a starting
            weather risk entry. The <b>geotechnical / soil risk lookup</b> checks free
            government soil survey data for the site — USDA soil survey (SSURGO) data in the
            United States, and Queensland Government soil and land resource mapping in
            Australia (more Australian states to follow) — and can flag things like reactive
            clay, poor drainage, or a shallow water table, suggesting a starting geotechnical
            risk entry where relevant. Outside those covered regions this lookup will tell you
            plainly rather than guess, so add a geotechnical risk row manually instead.
          </p>
          <p>
            Both lookups are a desktop-level early warning, not a substitute for a real site
            investigation — always confirm with your own geotechnical engineer, bores, or test
            pits before pricing footings or pavement subgrade.
          </p>
        </div>
      </div>
      <div className="section">
        <div className="section-head"><h3>Summary</h3></div>
        <div className="card" style={{ padding: "18px 22px" }}>
          <p>
            The full cost cascade: Direct cost → Preliminaries / Indirect Job Costs (General
            Conditions in the US) → Risk (from the register) → Contingency → Overhead → Margin →
            subtotal → Tax → Contract price (what you'd tender or bid) → + Client's
            administrative cost (called the Principal's cost in Australia/UK) → Total project
            cost. Every percentage is editable and recalculates live. Use "Print / Save PDF" for
            a clean printable version, or "Export line items (CSV)" for a spreadsheet of every
            priced line item.
          </p>
          <p>
            <b>Preliminaries / Indirect Job Costs</b> can be priced two ways — pick whichever
            suits the stage you're at. <b>Simple %</b> (the default) applies a flat percentage of
            direct cost, useful for an early, rough-order estimate. <b>Itemised build-up</b> lets
            you build it from real line items instead of a guess: each item is either a one-off
            <b> Fixed</b> cost (mobilisation, a performance bond, an insurance premium) or a
            <b> $/week Time-related</b> cost (site supervision, temporary services, site
            facilities) multiplied by the project duration you enter — so extending the
            programme automatically extends every time-related item with it, rather than needing
            to be re-typed. Switching between the two modes doesn't lose anything — your itemised
            list stays saved even while "Simple %" is selected, so you can flip back and forth
            freely.
          </p>
          <p>
            Two <b>Quick add</b> panels sit above the itemised list to save re-typing common
            items: one for on-site overhead and supervisory staff (Project Manager, Site
            Engineer, Quality Manager, Safety Officer, and more, plus a Custom role option), and
            one for insurances, bonds &amp; guarantees, permits, and mobilisation-type pay items.
            Pick an item, set its rate, and it's added to the list ready to fine-tune or
            re-categorise — nothing about the quick-add lists is exhaustive, so "+ Add item"
            still covers anything not listed.
          </p>
          <p>
            The <b>Risk-adjusted price range</b> table simulates thousands of outcomes of your
            risk register — each risk either happening, at its stated probability, or not — and
            shows a best-case, expected, and worst-case figure for the risk allowance, contract
            price, and total project cost. Treat it as a decision tool for setting your own
            contingency, not something to hand to a client on a competitive fixed-price bid —
            they want your price, not your worst case.
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
