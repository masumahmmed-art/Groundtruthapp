import type { BuildupComponent, CategoryRow, LineItemRow, Markups, RateItemRow, RiskItemRow } from "@/lib/types";

export function riskAllowance(risk: RiskItemRow): number {
  return (risk.probability / 100) * risk.impact;
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

export function itemUnitRate(rates: RateItemRow[], item: LineItemRow): number {
  return (
    compUnitCost(rates, item.labour) +
    compUnitCost(rates, item.plant) +
    compUnitCost(rates, item.material)
  );
}

export function itemLineTotal(rates: RateItemRow[], item: LineItemRow): number {
  return itemUnitRate(rates, item) * item.qty;
}

export function itemCostByType(rates: RateItemRow[], item: LineItemRow) {
  return {
    labour: compUnitCost(rates, item.labour) * item.qty,
    plant: compUnitCost(rates, item.plant) * item.qty,
    material: compUnitCost(rates, item.material) * item.qty,
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
      return t;
    },
    { labour: 0, plant: 0, material: 0 }
  );
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
  const prelim = direct * (markups.preliminaries / 100);
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
  const principalCost = contractPrice * (markups.principalCost / 100);
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
 * It deliberately does NOT assume risks partially occur or correlate with
 * each other — that would need more input than a simple register captures.
 */
export function simulateRiskRange(risks: RiskItemRow[], iterations: number = RISK_SIMULATION_ITERATIONS): RiskRange {
  const expected = totalRiskAllowance(risks);
  if (!risks.length) return { low: 0, expected: 0, high: 0 };

  const totals: number[] = new Array(iterations);
  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    for (const r of risks) {
      if (Math.random() * 100 < r.probability) sum += r.impact;
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
  contingency: 5,
  overhead: 6,
  margin: 8,
  principalCost: 5,
  gst: 10,
};

export const RISK_CATEGORY_LABELS: Record<string, string> = {
  weather: "Weather",
  geotechnical: "Geotechnical",
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
