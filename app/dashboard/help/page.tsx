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
            Your workspace's own labour, plant, material, and subcontract rates, reused across
            every project. Every new workspace starts with indicative rates so it works
            immediately — replace them with your own real supplier quotes, labour agreements,
            and subcontractor pricing before relying on this for a real tender.
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
            A build-up assembles a line item's unit rate from its actual Labour, Plant,
            Material, and Subcontract components, each pulled from your Rate Library with a
            "qty per unit" you set — not a lump-sum guess. If a column shows "None" and clicking
            "+ add" does nothing, your Rate Library doesn't have any items of that kind yet — add
            some there first.
          </p>
          <p>
            Every line item can also be switched to a <b>Flat rate ($)</b> instead of building up
            from parts — open the item and choose "Flat rate" if you'd rather just type its unit
            rate directly. This is useful for a quick allowance, a subcontractor's lump-sum
            quote for the whole item, or anything you don't want to break down into
            labour/plant/material/subcontract. Switching back to "Build up" doesn't lose the flat
            rate you typed — it's just not used while build-up mode is selected.
          </p>
          <p>
            When your workspace's unit system (see Settings) differs from a line item's own
            unit, a small greyed "≈" line shows the converted quantity and rate alongside it —
            the stored numbers themselves never change, only what's shown.
          </p>
          <p>
            <b>⇪ Import line items</b> (button above the category list) lets you bring in
            priced line items from another spreadsheet instead of typing them in one by one.
            Upload an Excel (.xlsx) or .csv file — if the workbook has more than one tab, you'll
            be asked which one to import from — or paste rows copied directly from Excel or
            Google Sheets. The importer looks for a row containing column headings like
            Description, Unit, Quantity, and Rate (however they're worded or ordered, and however
            far down the sheet they sit), then reads every row below it: a row with a description
            but no usable quantity or rate is treated as a section heading and becomes a new
            category, and a priced row underneath becomes a line item in that category. You get a
            preview with a checkbox per item before anything is actually imported, and you can
            rename each category or send it into an existing category instead of creating a new
            one. Imported items come in as Flat rate items, since a spreadsheet row typically
            carries one ready-made rate rather than a labour/plant/material breakdown — you can
            switch any of them to a build-up afterwards if you want to break the rate down further.
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
            the few where the range genuinely matters, like unexpected ground conditions. When
            Min and Max are set, the Summary tab's risk-adjusted price range treats that risk as
            a spread rather than one fixed number; leaving them blank just uses the single
            "Impact (likely)" figure.
          </p>
          <p>
            The <b>cost impact — and Min/Max — are always something you enter yourself.</b> None
            of the five lookups below know your project's dollar exposure, so none of them ever
            pre-fill a cost figure; each one can only suggest a probability and a description
            based on the hazard or trend it finds at the site. For the market / price escalation
            lookup, a reasonable starting point is the value of the affected material or trade
            package multiplied by the cost trend it shows you.
          </p>
          <p>
            Enter your site location once and use it for five live lookups. The <b>weather risk
            lookup</b> pulls historical climate data for the site and can suggest a starting
            weather risk entry. The <b>geotechnical / soil risk lookup</b> checks free
            government soil survey data for the site — USDA soil survey (SSURGO) data in the
            United States, and CSIRO's national Australian Soil Classification in Australia —
            and can flag things like reactive clay, poor drainage, or a shallow water table,
            suggesting a starting geotechnical risk entry where relevant.
          </p>
          <p>
            The <b>flood risk lookup</b> checks FEMA's National Flood Hazard Layer for US sites
            and can flag a mapped Special Flood Hazard Area, base flood elevation, or an
            unstudied zone, suggesting a starting flood risk entry where relevant. The
            <b> seismic risk lookup</b> checks USGS Design Maps in the United States and
            Geoscience Australia's National Seismic Hazard Assessment in Australia, and can flag
            a higher-than-typical Seismic Design Category or peak ground acceleration,
            suggesting a starting seismic risk entry where relevant.
          </p>
          <p>
            The <b>market / price escalation lookup</b> checks free government statistics on
            construction cost and materials price inflation for the site's country, and can flag
            an above-normal 12-month cost trend, suggesting a starting market risk entry where
            relevant. It covers the United States (Bureau of Labor Statistics), Australia
            (Australian Bureau of Statistics), the United Kingdom (Office for National
            Statistics), and every EU member state (Eurostat). Coverage depth varies by country —
            the US and Australia return one figure, the UK returns a small basket of individual
            material indices rather than one blended figure, and the EU figure is specific to new
            residential building construction rather than civil infrastructure — always check
            current supplier and subcontractor pricing before setting an escalation allowance.
          </p>
          <p>
            Outside the regions each lookup covers, it will tell you plainly rather than guess —
            add a risk row manually instead. All five lookups are a desktop-level early warning,
            not a substitute for a real site investigation or current market pricing — always
            confirm with your own geotechnical or structural engineer, bores or test pits, the
            actual FEMA FIRM panel, a project-specific seismic assessment, or current supplier
            quotes before pricing footings, pavement subgrade, flood-proofing, seismic detailing,
            or an escalation allowance.
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
          <p>
            <b>Client Cost</b> — the client's (Principal's) own project administration, shown
            separately after the contract price — can be priced the same two ways as
            Preliminaries. <b>Simple %</b> (the default) applies a flat percentage of the
            contract price. <b>Itemised build-up</b> lets you list it out instead: client-side
            roles (Project Director, Design Manager, PUP Coordinator, and more, plus a Custom
            role option) as <b>$/week Time-related</b> items, and one-off <b>Fixed</b> items
            like a geotechnical investigation, survey, or environmental approvals — with its own
            duration field, kept separate from the contractor's construction duration above,
            since the client's own administration usually spans more of the project (concept,
            design, delivery, and finalisation) than just the construction period.
          </p>
          <p>
            <b>Cash Flow</b> spreads the total project cost evenly across however many months you
            set, starting from the project's date, and shows it as a month-by-month table with a
            simple bar per month. It's a straight-line spread rather than a shaped construction
            curve — a first-pass view of roughly how much is spent per month, not a contractual
            payment schedule.
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
