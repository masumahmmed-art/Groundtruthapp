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
 */
export function fullBuildup(
  rates: RateItemRow[],
  items: LineItemRow[],
  markups: Markups,
  risks: RiskItemRow[] = []
): FullBuildup {
  const direct = directTotal(rates, items);
  const prelim = direct * (markups.preliminaries / 100);
  const risk = totalRiskAllowance(risks);
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
