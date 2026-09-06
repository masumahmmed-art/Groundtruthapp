// A small, hand-maintained index of Help/User-Guide topics, used by the
// top search bar (TopSearch.tsx). Deliberately not backed by any search
// library — the dataset is tiny (a page or two of topics), so a plain
// substring match over title/keywords is enough and needs zero new
// dependencies.
//
// Each entry can point at an anchor on the in-app Help page (helpAnchor,
// matching an id="..." on that section's outer <div className="section">)
// and/or a page number in the downloadable PDF guide (pdfPage). Either can
// be left null if that topic only exists in one place — e.g. the PDF's
// "Part One: first principles" chapter has no in-app equivalent.
//
// Keep this in sync with:
//  - app/dashboard/help/page.tsx section ids
//  - the current page layout of guide.html / GroundTruthEstimatorUserGuide.pdf

export interface HelpTopic {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  helpAnchor: string | null;
  pdfPage: number | null;
}

export const helpSearchIndex: HelpTopic[] = [
  {
    id: "first-principles",
    title: "First-principles estimating",
    description: "The thinking behind a sound estimate, before you open the software.",
    keywords: ["first principles", "estimating basics", "how to estimate", "fundamentals"],
    helpAnchor: null,
    pdfPage: 3,
  },
  {
    id: "workspace",
    title: "Your workspace",
    description: "How workspaces, teams and privacy work.",
    keywords: ["workspace", "company", "team", "privacy", "sign up"],
    helpAnchor: "workspace",
    pdfPage: 5,
  },
  {
    id: "rate-library",
    title: "Rate Library",
    description: "Your labour, plant, material and subcontract rates.",
    keywords: ["rate library", "rates", "labour rate", "plant rate", "material rate", "subcontract rate", "search the web"],
    helpAnchor: "rate-library",
    pdfPage: 5,
  },
  {
    id: "estimate",
    title: "Estimate — Bill of Quantities",
    description: "Categories, line items, and build-ups.",
    keywords: ["estimate", "bill of quantities", "boq", "line item", "build-up", "buildup", "category"],
    helpAnchor: "estimate",
    pdfPage: 6,
  },
  {
    id: "flat-rate",
    title: "Flat-rate line items",
    description: "Pricing a line item with one all-in rate instead of a build-up.",
    keywords: ["flat rate", "lump sum rate", "flat", "no build-up"],
    helpAnchor: "estimate",
    pdfPage: 6,
  },
  {
    id: "import",
    title: "Import line items",
    description: "Bringing in a spreadsheet or pasted BOQ.",
    keywords: ["import", "spreadsheet", "excel", "xlsx", "paste", "csv", "upload"],
    helpAnchor: "estimate",
    pdfPage: 6,
  },
  {
    id: "risk-location",
    title: "Risk & Location — site lookups",
    description: "Weather, geotechnical, flood, seismic and market lookups.",
    keywords: ["risk", "location", "weather", "geotechnical", "soil", "flood", "seismic", "market", "escalation", "lookup"],
    helpAnchor: "risk-location",
    pdfPage: 7,
  },
  {
    id: "risk-register",
    title: "Risk register",
    description: "Probability, impact, and Min/Max ranges for each risk.",
    keywords: ["risk register", "probability", "impact", "min max", "3-point estimate"],
    helpAnchor: "risk-location",
    pdfPage: 7,
  },
  {
    id: "summary",
    title: "Summary — cost cascade",
    description: "Direct cost through to Total project cost.",
    keywords: ["summary", "cost cascade", "contingency", "overhead", "margin", "tax", "contract price", "export", "print"],
    helpAnchor: "summary",
    pdfPage: 8,
  },
  {
    id: "preliminaries",
    title: "Preliminaries / Indirect Job Costs",
    description: "Simple % vs itemised build-up, quick-add panels.",
    keywords: ["preliminaries", "indirect job costs", "general conditions", "quick add", "mobilisation", "time-related"],
    helpAnchor: "summary",
    pdfPage: 8,
  },
  {
    id: "client-cost",
    title: "Client Cost",
    description: "The client/principal's administrative cost, itemised or as a %.",
    keywords: ["client cost", "principal's cost", "administrative cost"],
    helpAnchor: "summary",
    pdfPage: 8,
  },
  {
    id: "cash-flow",
    title: "Cash Flow",
    description: "A month-by-month spread of the total project cost.",
    keywords: ["cash flow", "cashflow", "monthly spread", "s-curve", "programme"],
    helpAnchor: "summary",
    pdfPage: 8,
  },
  {
    id: "risk-range",
    title: "Risk-adjusted price range",
    description: "Best-case / expected / worst-case simulation.",
    keywords: ["risk-adjusted", "price range", "simulation", "best case", "worst case", "monte carlo"],
    helpAnchor: "summary",
    pdfPage: 8,
  },
  {
    id: "programme",
    title: "Programme",
    description: "Schedule dates, Duration, Predecessor/Lag, and Primavera P6 import.",
    keywords: ["programme", "program", "schedule", "duration", "predecessor", "successor", "lag", "primavera", "p6", "xer", "gantt", "planned value", "schedule history", "snapshot"],
    helpAnchor: "programme",
    pdfPage: 9,
  },
  {
    id: "positions",
    title: "Positions",
    description: "The Indirect Job Cost register — Wage vs Salaried and the RCM.",
    keywords: ["positions", "indirect job cost", "ijc", "wage", "salaried", "reimbursable cost multiplier", "rcm", "onsite overhead"],
    helpAnchor: "positions",
    pdfPage: 10,
  },
  {
    id: "actuals",
    title: "Actuals",
    description: "Direct/Indirect Job Cost ledgers — rate-linked, fully editable.",
    keywords: ["actuals", "actual cost", "ac", "direct job cost", "djc", "indirect job cost", "ijc", "ledger", "rate item", "quantity", "invoice number", "subcontract"],
    helpAnchor: "actuals",
    pdfPage: 10,
  },
  {
    id: "earned-value",
    title: "Earned Value",
    description: "% complete, Earned Value, and Earned Value Management.",
    keywords: ["earned value", "ev", "percent complete", "% complete", "earned value management", "evm", "cpi", "spi", "planned value", "actual cost"],
    helpAnchor: "earned-value",
    pdfPage: 11,
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description: "One rolled-up view — cost by category, cash flow, resource type.",
    keywords: ["dashboard", "major category", "report", "customise", "customize", "filter", "print"],
    helpAnchor: "dashboard",
    pdfPage: 12,
  },
  {
    id: "settings",
    title: "Settings",
    description: "Currency and unit system for your workspace.",
    keywords: ["settings", "currency", "unit system", "metric", "imperial"],
    helpAnchor: "settings",
    pdfPage: 5,
  },
  {
    id: "account",
    title: "Your account",
    description: "Forgot password, signing up with an existing email.",
    keywords: ["account", "password", "forgot password", "login", "sign in", "sign up"],
    helpAnchor: "account",
    pdfPage: 15,
  },
];
