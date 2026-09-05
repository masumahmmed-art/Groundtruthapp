import type {
  BuildupComponent,
  CategoryRow,
  ClientCostCategory,
  ClientCostItem,
  LineItemRow,
  Markups,
  PreliminaryCategory,
  PreliminaryItem,
  RateItemRow,
  RiskItemRow,
} from "@/lib/types";

/** True when a risk has a usable min/max range in addition to its `impact` (likely) figure. */
function hasImpactRange(risk: RiskItemRow): boolean {
  return (
    typeof risk.impact_min === "number" &&
    typeof risk.impact_max === "number" &&
    (risk.impact_max as number) > (risk.impact_min as number)
  );
}

/** The "likely" value clamped inside [min, max], for risks that have a range set. */
function likelyImpact(risk: RiskItemRow): number {
  if (!hasImpactRange(risk)) return risk.impact;
  const min = risk.impact_min as number;
  const max = risk.impact_max as number;
  return Math.min(Math.max(risk.impact, min), max);
}

/** Mean of a triangular(min, likely, max) distribution — used for the deterministic expected value. */
function meanImpact(risk: RiskItemRow): number {
  if (!hasImpactRange(risk)) return risk.impact;
  const min = risk.impact_min as number;
  const max = risk.impact_max as number;
  return (min + likelyImpact(risk) + max) / 3;
}

/** Draws one random sample from a triangular(min, likely, max) distribution. */
function sampleTriangular(min: number, likely: number, max: number): number {
  if (max <= min) return likely;
  const u = Math.random();
  const c = (likely - min) / (max - min);
  if (u < c) return min + Math.sqrt(u * (max - min) * (likely - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - likely));
}

/** One simulated cost impact for a risk, if it occurs — a random draw from its range, or its fixed impact figure if no range is set. */
function sampleImpact(risk: RiskItemRow): number {
  if (!hasImpactRange(risk)) return risk.impact;
  return sampleTriangular(risk.impact_min as number, likelyImpact(risk), risk.impact_max as number);
}

export function riskAllowance(risk: RiskItemRow): number {
  return (risk.probability / 100) * meanImpact(risk);
}

export function totalRiskAllowance(risks: RiskItemRow[]): number {
  return risks.reduce((sum, r) => sum + riskAllowance(r), 0);
}

export function rateById(rates: RateItemRow[], id: string): RateItemRow | undefined {
  return rates.find((r) => r.id === id);
}

export function compUnitCost(rates: RateItemRow[], list: BuildupComponent[] | undefined | null): number {
  if (!list) return 0;
  return list.reduce((sum, c) => {
    const r = rateById(rates, c.ref);
    return sum + (r ? c.perUnit * r.rate : 0);
  }, 0);
}

/**
 * A line item's unit rate: either the flat rate typed directly (rate_mode
 * "flat" — used by imported items, or any item you'd rather not build up
 * from the Rate Library), or the sum of its labour/plant/material/subcontract
 * build-up (rate_mode "buildup", the default — unset rate_mode is treated as
 * "buildup" for items that predate this field).
 */
export function itemUnitRate(rates: RateItemRow[], item: LineItemRow): number {
  if (item.rate_mode === "flat") return item.flat_rate || 0;
  return (
    compUnitCost(rates, item.labour) +
    compUnitCost(rates, item.plant) +
    compUnitCost(rates, item.material) +
    compUnitCost(rates, item.subcontract)
  );
}

export function itemLineTotal(rates: RateItemRow[], item: LineItemRow): number {
  return itemUnitRate(rates, item) * item.qty;
}

export function itemCostByType(rates: RateItemRow[], item: LineItemRow) {
  if (item.rate_mode === "flat") {
    // A flat-rate item has no labour/plant/material/subcontract split to
    // report — its whole line total is shown under "material" so it still
    // shows up somewhere in the cost-by-resource-type chart rather than
    // silently vanishing from it.
    return { labour: 0, plant: 0, material: itemUnitRate(rates, item) * item.qty, subcontract: 0 };
  }
  return {
    labour: compUnitCost(rates, item.labour) * item.qty,
    plant: compUnitCost(rates, item.plant) * item.qty,
    material: compUnitCost(rates, item.material) * item.qty,
    subcontract: compUnitCost(rates, item.subcontract) * item.qty,
  };
}

export function categoryTotal(rates: RateItemRow[], items: LineItemRow[], categoryId: string): number {
  return items
    .filter((it) => it.category_id === categoryId)
    .reduce((sum, it) => sum + itemLineTotal(rates, it), 0);
}

export function directTotal(rates: RateItemRow[], items: LineItemRow[]): number {
  return items.reduce((sum, it) => sum + itemLineTotal(rates, it), 0);
}

export function costTypeTotals(rates: RateItemRow[], items: LineItemRow[]) {
  return items.reduce(
    (t, it) => {
      const b = itemCostByType(rates, it);
      t.labour += b.labour;
      t.plant += b.plant;
      t.material += b.material;
      t.subcontract += b.subcontract;
      return t;
    },
    { labour: 0, plant: 0, material: 0, subcontract: 0 }
  );
}

/** One item's contribution to the preliminaries total: its fixed cost as-is, or rate × duration if time-related. */
export function preliminaryItemTotal(item: PreliminaryItem, durationWeeks: number): number {
  return item.type === "time_related" ? item.rate * durationWeeks : item.rate;
}

/** Sum of an itemised preliminaries build-up — fixed items plus every time-related item's rate × project duration. */
export function preliminariesBuildupTotal(items: PreliminaryItem[] | undefined | null, durationWeeks: number): number {
  if (!items || !items.length) return 0;
  return items.reduce((sum, it) => sum + preliminaryItemTotal(it, durationWeeks), 0);
}

/** The preliminaries total to use in the cost cascade, respecting whichever mode (percent vs itemised build-up) the project is set to. Defaults to percent mode for older projects that predate the build-up feature. */
export function preliminariesTotal(markups: Markups, direct: number): number {
  if (markups.preliminariesMode === "buildup") {
    return preliminariesBuildupTotal(markups.preliminariesItems, markups.projectDurationWeeks || 0);
  }
  return direct * (markups.preliminaries / 100);
}

/** One item's contribution to the client-cost total — same fixed-vs-time-related shape as preliminaryItemTotal. */
export function clientCostItemTotal(item: ClientCostItem, durationWeeks: number): number {
  return item.type === "time_related" ? item.rate * durationWeeks : item.rate;
}

/** Sum of an itemised client-cost build-up. */
export function clientCostBuildupTotal(items: ClientCostItem[] | undefined | null, durationWeeks: number): number {
  if (!items || !items.length) return 0;
  return items.reduce((sum, it) => sum + clientCostItemTotal(it, durationWeeks), 0);
}

/** The client's administrative cost, computed against the contractor's contract price — respecting percent vs itemised build-up mode. Defaults to percent mode for older projects that predate the build-up feature. */
export function clientCostTotal(markups: Markups, contractPrice: number): number {
  if (markups.principalCostMode === "buildup") {
    const weeks = markups.clientCostDurationWeeks ?? markups.projectDurationWeeks ?? 0;
    return clientCostBuildupTotal(markups.principalCostItems, weeks);
  }
  return contractPrice * (markups.principalCost / 100);
}

export interface FullBuildup {
  direct: number;
  prelim: number;
  risk: number; // itemised risk register total (expected value, $)
  cont: number;
  overhead: number;
  margin: number;
  s3: number; // subtotal ex GST (contractor side)
  gst: number;
  contractPrice: number; // = s3 + gst — what the contractor would tender
  principalCost: number; // client-side admin cost, informational, not part of contract price
  totalProjectCost: number; // = contractPrice + principalCost
}

/**
 * Cascade: Direct -> +Preliminaries -> +Risk (from register) -> +Contingency
 * -> +Overhead -> +Margin -> subtotal ex GST -> +GST -> Contract Price.
 * Principal's Administrative Cost is then added on top as a separate,
 * client-side line to produce the Total Project Cost — it is NOT part of
 * the contractor's tender price or its GST calculation.
 *
 * riskOverride: if provided, this exact dollar figure is used for the risk
 * line instead of the deterministic expected value computed from `risks`.
 * Used to re-run the same cascade for the low/high ends of the simulated
 * risk range (see simulateRiskRange below) without duplicating this logic.
 */
export function fullBuildup(
  rates: RateItemRow[],
  items: LineItemRow[],
  markups: Markups,
  risks: RiskItemRow[] = [],
  riskOverride?: number
): FullBuildup {
  const direct = directTotal(rates, items);
  const prelim = preliminariesTotal(markups, direct);
  const risk = riskOverride !== undefined ? riskOverride : totalRiskAllowance(risks);
  const s0 = direct + prelim + risk;
  const cont = s0 * (markups.contingency / 100);
  const s1 = s0 + cont;
  const overhead = s1 * (markups.overhead / 100);
  const s2 = s1 + overhead;
  const margin = s2 * (markups.margin / 100);
  const s3 = s2 + margin;
  const gst = s3 * (markups.gst / 100);
  const contractPrice = s3 + gst;
  const principalCost = clientCostTotal(markups, contractPrice);
  const totalProjectCost = contractPrice + principalCost;
  return { direct, prelim, risk, cont, overhead, margin, s3, gst, contractPrice, principalCost, totalProjectCost };
}

export interface RiskRange {
  low: number; // 10th percentile simulated risk total ("best case")
  expected: number; // deterministic expected value — same as totalRiskAllowance()
  high: number; // 90th percentile simulated risk total ("if things go wrong")
}

export const RISK_SIMULATION_ITERATIONS = 8000;

/**
 * A lightweight Monte Carlo simulation of the itemised risk register.
 *
 * Each risk is modelled as an independent event: with its stated
 * probability, the full cost impact happens; otherwise it doesn't. This
 * runs many simulated versions of the project, sums the risks that "hit"
 * in each one, and reads off the 10th/90th percentiles — giving a
 * defensible low/expected/high spread instead of a single blended number.
 * It deliberately does NOT assume correlation between risks — that would
 * need more input than a simple register captures. It DOES, however,
 * sample a triangular(min, likely, max) distribution for the cost impact
 * itself, for any risk where a min/max range has been entered — for risks
 * with just a single impact figure, that fixed figure is used as before.
 */
export function simulateRiskRange(risks: RiskItemRow[], iterations: number = RISK_SIMULATION_ITERATIONS): RiskRange {
  const expected = totalRiskAllowance(risks);
  if (!risks.length) return { low: 0, expected: 0, high: 0 };

  const totals: number[] = new Array(iterations);
  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    for (const r of risks) {
      if (Math.random() * 100 < r.probability) sum += sampleImpact(r);
    }
    totals[i] = sum;
  }
  totals.sort((a, b) => a - b);

  const percentile = (p: number) => {
    const idx = Math.min(totals.length - 1, Math.max(0, Math.round(p * (totals.length - 1))));
    return totals[idx];
  };

  return {
    low: percentile(0.1),
    expected,
    high: percentile(0.9),
  };
}

export const numFmt = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 });

export function pct1(n: number): string {
  return `${Math.round(n * 10) / 10}%`;
}

export const DEFAULT_MARKUPS: Markups = {
  preliminaries: 8,
  preliminariesMode: "percent",
  preliminariesItems: [],
  projectDurationWeeks: 12,
  contingency: 5,
  overhead: 6,
  margin: 8,
  principalCost: 5,
  principalCostMode: "percent",
  principalCostItems: [],
  clientCostDurationWeeks: 12,
  gst: 10,
  cashFlowMonths: 12,
};

/**
 * Common contractor's on-site overhead / supervisory staff roles for a
 * civil infrastructure project. Purely a convenience list for the
 * "quick add" picker in the preliminaries build-up — selecting one drops
 * in a ready-made time-related ($/week) item under the "Site management
 * & supervision" category, so the estimator only has to fill in the rate.
 * Not exhaustive — "+ Add item" still covers anything not listed here.
 */
export const SITE_STAFF_PRESETS: string[] = [
  "Project Director",
  "Project Manager",
  "Site Manager / Construction Manager",
  "General Foreman / Site Foreman",
  "Site Engineer",
  "Project Engineer",
  "Quantity Surveyor / Cost Controller",
  "Quality Manager / QA Representative",
  "Environmental Manager",
  "Surveyor / Setout Engineer",
  "Safety Officer (WHS/HSE Manager)",
  "Traffic Management Coordinator",
  "Community & Stakeholder Relations Officer",
  "Contracts Administrator",
  "Document Controller",
  "Site Administrator",
];
// Note: deliberately NOT labelled "Superintendent" on its own — under AU
// standard-form contracts (AS2124/AS4000) that term specifically means the
// PRINCIPAL's (client's) contract administrator, not contractor staff.
// "Site Manager / Construction Manager" is the contractor-side equivalent
// role in AU/UK usage; "Superintendent" remains the correct term in US usage.

export interface PreliminaryPreset {
  description: string;
  category: PreliminaryCategory;
  type: "fixed" | "time_related";
}

/**
 * Common non-staff preliminaries / indirect job cost pay items — insurances,
 * bonds & guarantees, permits, mobilisation and the like. A convenience list
 * for the "quick add" picker alongside SITE_STAFF_PRESETS, so these don't
 * have to be typed from scratch either. Most are realistically one-off costs
 * (type "fixed"); a couple (site security, waste management) are more often
 * priced $/week — either way, every quick-added item can still have its
 * type and category changed afterwards like any other row.
 */
export const PRELIMINARY_ITEM_PRESETS: PreliminaryPreset[] = [
  { description: "Mobilisation", category: "mobilisation", type: "fixed" },
  { description: "Demobilisation", category: "mobilisation", type: "fixed" },
  { description: "Site establishment (compound, fencing, hoarding)", category: "site_facilities", type: "fixed" },
  { description: "Site sheds & amenities", category: "site_facilities", type: "time_related" },
  { description: "Temporary power & water", category: "temporary_services", type: "time_related" },
  { description: "Site security (guards / patrols)", category: "security", type: "time_related" },
  { description: "Contract works / construction all-risks insurance", category: "insurances", type: "fixed" },
  { description: "Public liability insurance", category: "insurances", type: "fixed" },
  { description: "Professional indemnity insurance", category: "insurances", type: "fixed" },
  { description: "Workers compensation insurance", category: "insurances", type: "fixed" },
  { description: "Performance bond", category: "bonds_guarantees", type: "fixed" },
  { description: "Unconditional / bank guarantee", category: "bonds_guarantees", type: "fixed" },
  { description: "Statutory permits & approvals", category: "permits_approvals", type: "fixed" },
  { description: "Traffic management plan & approval", category: "permits_approvals", type: "fixed" },
  { description: "Waste management & site cleaning", category: "cleaning_waste", type: "time_related" },
];

export const PRELIMINARY_CATEGORY_LABELS: Record<string, string> = {
  site_management: "Site management & supervision",
  site_facilities: "Site facilities",
  temporary_services: "Temporary services",
  security: "Security",
  temporary_works: "Temporary works",
  quality_safety_environmental: "Quality, safety & environmental",
  cleaning_waste: "Cleaning & waste management",
  insurances: "Insurances",
  bonds_guarantees: "Bonds & guarantees",
  permits_approvals: "Permits & approvals",
  mobilisation: "Mobilisation / demobilisation",
  other: "Other",
};

/**
 * Common CLIENT-side ("Principal's") staff roles running the project from
 * the client's own team — as distinct from SITE_STAFF_PRESETS above, which
 * are contractor staff. Used by the "quick add" picker in the client-cost
 * build-up.
 */
export const CLIENT_STAFF_PRESETS: string[] = [
  "Project Director",
  "Project Manager",
  "Design Manager",
  "Project Officer",
  "Project Scheduler",
  "Communications Officer",
  "Project Support Officer",
  "Technical Advisor",
  "Public Utility Plant (PUP) Coordinator",
  "Environmental & Cultural Heritage Officer",
  "Contract Superintendent",
  "Contract Administrator",
];

export interface ClientCostPreset {
  description: string;
  category: ClientCostCategory;
  type: "fixed" | "time_related";
}

/**
 * Common one-off client-side studies, investigations and approvals pay
 * items. A convenience list for the "quick add" picker alongside
 * CLIENT_STAFF_PRESETS.
 */
export const CLIENT_COST_ITEM_PRESETS: ClientCostPreset[] = [
  { description: "Environmental approvals & assessment", category: "environmental_approvals", type: "fixed" },
  { description: "Geotechnical investigation", category: "design_investigation", type: "fixed" },
  { description: "Survey", category: "design_investigation", type: "fixed" },
  { description: "Contaminated land investigation", category: "design_investigation", type: "fixed" },
  { description: "Noise assessment", category: "design_investigation", type: "fixed" },
  { description: "Public utility plant (PUP) potholing", category: "design_investigation", type: "fixed" },
  { description: "Detailed design — Stage 1", category: "design_investigation", type: "fixed" },
  { description: "Detailed design — issued for construction (IFC)", category: "design_investigation", type: "fixed" },
  { description: "Property / land acquisition costs", category: "property_acquisition", type: "fixed" },
  { description: "Property acquisition — transactional & other costs", category: "property_acquisition", type: "fixed" },
];

export const CLIENT_COST_CATEGORY_LABELS: Record<string, string> = {
  project_management: "Project management",
  design_investigation: "Design & investigation",
  environmental_approvals: "Environmental approvals",
  property_acquisition: "Property acquisition",
  contract_administration: "Contract administration",
  other: "Other",
};

export const RISK_CATEGORY_LABELS: Record<string, string> = {
  weather: "Weather",
  geotechnical: "Geotechnical",
  flood: "Flood",
  seismic: "Seismic",
  programme: "Programme",
  market: "Market / Price escalation",
  safety: "Safety",
  other: "Other",
};

export const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
  { name: "Earthworks & Site Works", color: "var(--cat-earth)" },
  { name: "Roads & Pavements", color: "var(--cat-pave)" },
  { name: "Drainage & Pipelines", color: "var(--cat-drain)" },
  { name: "Structures (Bridges & Culverts)", color: "var(--cat-struct)" },
];

// A small rotating palette used to colour categories created by the
// spreadsheet importer — deliberately reuses the same CSS variables the app
// already defines for DEFAULT_CATEGORIES plus the resource-type chart, so no
// new colours need to be added to the stylesheet.
export const IMPORT_CATEGORY_COLORS: string[] = [
  "var(--cat-earth)",
  "var(--cat-pave)",
  "var(--cat-drain)",
  "var(--cat-struct)",
  "var(--cost-labour)",
  "var(--cost-plant)",
  "var(--cost-material)",
  "var(--cost-markup)",
];

export interface CashFlowMonth {
  label: string; // e.g. "Mar 2027"
  amount: number; // this month's spend
  cumulative: number; // running total through this month
  cumulativePct: number; // running total as a % of the full total, 0-100
}

/**
 * An even (straight-line) spread of the total project cost across `months`
 * calendar months, starting from `startDate` (a "YYYY-MM-DD" string, as
 * stored on projects.project_date). Deliberately simple — a straight-line
 * spread rather than a front/back-loaded S-curve — since this app doesn't
 * track a construction programme in enough detail to justify a shaped curve;
 * it's meant to give a defensible first-pass view of "roughly how much a
 * month", not a contractual payment schedule.
 */
export function cashFlowSchedule(totalProjectCost: number, months: number, startDate: string): CashFlowMonth[] {
  const n = Math.max(1, Math.round(months || 1));
  const monthly = totalProjectCost / n;

  const start = new Date(startDate || new Date().toISOString().slice(0, 10));
  const startYear = isNaN(start.getTime()) ? new Date().getFullYear() : start.getFullYear();
  const startMonth = isNaN(start.getTime()) ? new Date().getMonth() : start.getMonth();

  const fmt = new Intl.DateTimeFormat("en-AU", { month: "short", year: "numeric" });

  const rows: CashFlowMonth[] = [];
  let cumulative = 0;
  for (let i = 0; i < n; i++) {
    cumulative += monthly;
    const d = new Date(startYear, startMonth + i, 1);
    rows.push({
      label: fmt.format(d),
      amount: monthly,
      cumulative,
      cumulativePct: totalProjectCost > 0 ? (cumulative / totalProjectCost) * 100 : 0,
    });
  }
  return rows;
}

// ---- Dashboard: Major Category roll-up ----
//
// A project's categories are often imported from a large, granular BOQ
// (dozens of pay-item categories) rather than typed by hand, so grouping
// them into a handful of high-level "Major Categories" (Earthworks, Roads &
// Pavements, Drainage, Structures & Bridgework, etc.) is deliberately a
// one-time MANUAL mapping the estimator does once per project — via the
// Dashboard tab's mapping panel — rather than an automatic keyword guess
// that could silently misclassify an unfamiliar category name.

/** Suggested Major Category names shown in the Dashboard's mapping datalist. Not exhaustive — any free text can be typed instead. */
export const MAJOR_CATEGORY_PRESETS: string[] = [
  "Earthworks",
  "Roads & Pavements",
  "Drainage",
  "Structures & Bridgework",
  "Traffic Management & Signage",
  "Utilities & Services",
  "Landscaping & Environmental",
  "Site Establishment & Preliminaries",
  "Other",
];

// A rotating palette for Dashboard groupings, since Major Categories are
// free text (not one of the four fixed --cat-* colours DEFAULT_CATEGORIES
// uses) — reuses the same CSS variables already defined elsewhere so no new
// colours need to be added to the stylesheet.
export const DASHBOARD_GROUP_COLORS: string[] = [
  "var(--cat-earth)",
  "var(--cat-pave)",
  "var(--cat-drain)",
  "var(--cat-struct)",
  "var(--cost-labour)",
  "var(--cost-plant)",
  "var(--cost-material)",
  "var(--cost-subcontract)",
  "var(--cost-markup)",
];

export interface MajorCategoryGroup {
  name: string;
  value: number;
  categoryIds: string[];
}

/**
 * Rolls every category's direct cost up into its assigned Major Category
 * (categories.major_category), for the Dashboard tab's high-level chart.
 * Categories that haven't been mapped yet (major_category null/blank) are
 * grouped under "Unmapped" so their cost never silently disappears from the
 * total — the Dashboard's mapping panel is how you clear that bucket.
 */
export function majorCategoryTotals(
  rates: RateItemRow[],
  items: LineItemRow[],
  categories: CategoryRow[]
): MajorCategoryGroup[] {
  const groups = new Map<string, MajorCategoryGroup>();
  for (const cat of categories) {
    const key = (cat.major_category || "").trim() || "Unmapped";
    const total = categoryTotal(rates, items, cat.id);
    const existing = groups.get(key);
    if (existing) {
      existing.value += total;
      existing.categoryIds.push(cat.id);
    } else {
      groups.set(key, { name: key, value: total, categoryIds: [cat.id] });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.value - a.value);
}
