"use client";

import { createClient } from "@/lib/supabase/client";
import type { CategoryRow, LineItemRow, Markups, ProjectRow, RateItemRow, RiskItemRow } from "@/lib/types";
import { categoryTotal, costTypeTotals, type FullBuildup } from "@/lib/calc";
import { formatMoney } from "@/lib/units";

export default function SummaryTab({
  project,
  setProject,
  categories,
  items,
  risks,
  rates,
  build,
  currency,
}: {
  project: ProjectRow;
  setProject: (updater: (p: ProjectRow) => ProjectRow) => void;
  categories: CategoryRow[];
  items: LineItemRow[];
  risks: RiskItemRow[];
  rates: RateItemRow[];
  build: FullBuildup;
  currency: string;
}) {
  const supabase = createClient();
  const markups = project.markups as Markups;

  function changeMarkup(key: keyof Markups, value: number) {
    const next = { ...markups, [key]: value };
    setProject((p) => ({ ...p, markups: next }));
  }
  async function persistMarkups() {
    await supabase.from("projects").update({ markups }).eq("id", project.id);
  }

  const byType = costTypeTotals(rates, items);
  const catRows = categories
    .map((c) => ({ name: c.name, color: c.color, value: categoryTotal(rates, items, c.id) }))
    .filter((r) => r.value > 0);
  const typeRows = [
    { name: "Labour", color: "var(--cost-labour)", value: byType.labour },
    { name: "Plant", color: "var(--cost-plant)", value: byType.plant },
    { name: "Material", color: "var(--cost-material)", value: byType.material },
    { name: "Risk, contingency, overhead & margin", color: "var(--cost-markup)", value: build.risk + build.cont + build.overhead + build.margin },
  ].filter((r) => r.value > 0);

  function exportCsv() {
    const header = ["Category", "Description", "Unit", "Quantity", `Unit Rate (${currency})`, `Line Total (${currency})`];
    const rows: string[][] = [];
    categories.forEach((cat) => {
      items.filter((i) => i.category_id === cat.id).forEach((it) => {
        const unitRate = (it.labour.concat(it.plant, it.material) as any[]).reduce((sum, c) => {
          const r = rates.find((rr) => rr.id === c.ref);
          return sum + (r ? c.perUnit * r.rate : 0);
        }, 0);
        rows.push([cat.name, it.description, it.unit, String(it.qty), unitRate.toFixed(2), (unitRate * it.qty).toFixed(2)]);
      });
    });
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/[^a-z0-9]+/gi, "_")}_line_items.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function StackBar({ rows, total }: { rows: { name: string; color: string; value: number }[]; total: number }) {
    if (!rows.length || total <= 0) return <div className="empty">No costs yet — add line items in the Estimate tab.</div>;
    return (
      <>
        <div className="stackbar">
          {rows.map((r) => {
            const w = (r.value / total) * 100;
            return (
              <div key={r.name} className="seg" style={{ width: `${w}%`, background: r.color }} title={`${r.name}: ${formatMoney(r.value, currency)}`}>
                {w > 9 && <span>{Math.round(w)}%</span>}
              </div>
            );
          })}
        </div>
        <div className="legend">
          {rows.map((r) => (
            <div className="legend-item" key={r.name}>
              <span className="sw" style={{ background: r.color }}></span>
              {r.name} <b>{formatMoney(r.value, currency)}</b>
            </div>
          ))}
        </div>
      </>
    );
  }

  function MarkupRow({ label, value, mkKey }: { label: string; value: number; mkKey?: keyof Markups }) {
    return (
      <tr>
        <td className="label-cell">{label}</td>
        <td className="num" style={{ width: 110 }}>
          {mkKey && (
            <>
              <input
                type="number" className="mono" step="0.1"
                value={markups[mkKey]}
                onChange={(e) => changeMarkup(mkKey, parseFloat(e.target.
