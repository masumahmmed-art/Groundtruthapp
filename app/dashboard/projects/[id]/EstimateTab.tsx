"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BuildupComponent, CategoryRow, LineItemRow, ProjectRow, RateItemRow } from "@/lib/types";
import { categoryTotal, directTotal, itemUnitRate, numFmt, rateById } from "@/lib/calc";
import { formatMoney, convertedDisplay, type UnitSystem } from "@/lib/units";
import ImportDialog from "./ImportDialog";

type BuildupKey = "labour" | "plant" | "material" | "subcontract";

export default function EstimateTab({
  project,
  categories,
  setCategories,
  items,
  setItems,
  rates,
  currency,
  unitSystem,
}: {
  project: ProjectRow;
  categories: CategoryRow[];
  setCategories: (updater: (c: CategoryRow[]) => CategoryRow[]) => void;
  items: LineItemRow[];
  setItems: (updater: (i: LineItemRow[]) => LineItemRow[]) => void;
  rates: RateItemRow[];
  currency: string;
  unitSystem: UnitSystem;
}) {
  const supabase = createClient();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  async function addCategory() {
    const name = prompt("New category name:", "New Category");
    if (!name) return;
    const { data, error } = await supabase
      .from("categories")
      .insert({ project_id: project.id, name, color: "var(--ink-soft)", sort_order: categories.length + 1 })
      .select("*")
      .single();
    if (!error && data) setCategories((prev) => [...prev, data as CategoryRow]);
  }

  async function addItem(categoryId: string) {
    const { data, error } = await supabase
      .from("line_items")
      .insert({
        category_id: categoryId,
        description: "New line item",
        unit: "unit",
        qty: 1,
        labour: [],
        plant: [],
        material: [],
        subcontract: [],
        rate_mode: "buildup",
        flat_rate: 0,
      })
      .select("*")
      .single();
    if (!error && data) {
      setItems((prev) => [...prev, data as LineItemRow]);
      setOpenItem((data as LineItemRow).id);
    }
  }

  async function deleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("line_items").delete().eq("id", id);
  }

  function updateItemLocal(id: string, patch: Partial<LineItemRow>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function persistItem(id: string, patch: Partial<LineItemRow>) {
    await supabase.from("line_items").update(patch).eq("id", id);
  }

  function updateComponent(itemId: string, key: BuildupKey, idx: number, patch: Partial<BuildupComponent>) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const list = [...(item[key] as BuildupComponent[])];
    list[idx] = { ...list[idx], ...patch };
    updateItemLocal(itemId, { [key]: list } as Partial<LineItemRow>);
    persistItem(itemId, { [key]: list } as Partial<LineItemRow>);
  }

  function addComponent(itemId: string, key: BuildupKey) {
    const item = items.find((i) => i.id === itemId);
    const pool = rates.filter((r) => r.kind === key);
    if (!item || !pool.length) return;
    const list = [...(item[key] as BuildupComponent[]), { ref: pool[0].id, perUnit: 0 }];
    updateItemLocal(itemId, { [key]: list } as Partial<LineItemRow>);
    persistItem(itemId, { [key]: list } as Partial<LineItemRow>);
  }

  function removeComponent(itemId: string, key: BuildupKey, idx: number) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const list = (item[key] as BuildupComponent[]).filter((_, i) => i !== idx);
    updateItemLocal(itemId, { [key]: list } as Partial<LineItemRow>);
    persistItem(itemId, { [key]: list } as Partial<LineItemRow>);
  }

  function setRateMode(itemId: string, mode: "buildup" | "flat") {
    updateItemLocal(itemId, { rate_mode: mode });
    persistItem(itemId, { rate_mode: mode });
  }

  function setFlatRate(itemId: string, value: number) {
    updateItemLocal(itemId, { flat_rate: value });
  }

  function persistFlatRate(itemId: string, value: number) {
    persistItem(itemId, { flat_rate: value });
  }

  const direct = directTotal(rates, items);

  return (
    <div>
      <div className="titleblock">
        <div>
          <h2 style={{ fontSize: 20 }}>Bill of Quantities</h2>
          <div className="meta">Grouped by work category. Click a line item to open its first-principles buildup.</div>
        </div>
        <div className="stamp">
          Direct cost
          <br />
          <span className="mono" style={{ fontSize: 16, color: "var(--ink)" }}>{formatMoney(direct, currency)}</span>
        </div>
      </div>

      {categories.map((cat) => {
        const catItems = items.filter((i) => i.category_id === cat.id);
        const isCollapsed = !!collapsed[cat.id];
        return (
          <div className="cat-block" key={cat.id}>
            <div
              className={"cat-head" + (isCollapsed ? " collapsed" : "")}
              onClick={() => setCollapsed((c) => ({ ...c, [cat.id]: !c[cat.id] }))}
            >
              <div className="cat-head-left">
                <span className="chev">▾</span>
                <span className="cat-swatch" style={{ background: cat.color }}></span>
                <h4>{cat.name}</h4>
              </div>
              <div className="cat-total mono">{formatMoney(categoryTotal(rates, items, cat.id), currency)}</div>
            </div>
            {!isCollapsed && (
              <div>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: "44%" }}>Description</th>
                      <th style={{ width: 70 }}>Unit</th>
                      <th className="num" style={{ width: 90 }}>Qty</th>
                      <th className="num" style={{ width: 110 }}>Unit rate</th>
                      <th className="num" style={{ width: 120 }}>Line total</th>
                      <th style={{ width: 36 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {catItems.length === 0 && (
                      <tr>
                        <td colSpan={6} className="empty">No line items in this category yet.</td>
                      </tr>
                    )}
                    {catItems.map((item) => {
                      const rate = itemUnitRate(rates, item);
                      const open = openItem === item.id;
                      return (
                        <FragmentRow
                          key={item.id}
                          item={item}
                          open={open}
                          rate={rate}
                          rates={rates}
                          currency={currency}
                          unitSystem={unitSystem}
                          onToggle={() => setOpenItem(open ? null : item.id)}
                          onDelete={() => deleteItem(item.id)}
                          onFieldChange={(patch) => updateItemLocal(item.id, patch)}
                          onFieldBlur={(patch) => persistItem(item.id, patch)}
                          onAddComponent={(key) => addComponent(item.id, key)}
                          onRemoveComponent={(key, idx) => removeComponent(item.id, key, idx)}
                          onComponentChange={(key, idx, patch) => updateComponent(item.id, key, idx, patch)}
                          onSetRateMode={(mode) => setRateMode(item.id, mode)}
                          onFlatRateChange={(v) => setFlatRate(item.id, v)}
                          onFlatRateBlur={(v) => persistFlatRate(item.id, v)}
                        />
                      );
                    })}
                  </tbody>
                </table>
                <div className="cat-foot">
                  <button className="btn btn-sm" onClick={() => addItem(cat.id)}>+ Add line item</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn" onClick={addCategory}>+ Add category</button>
        <button className="btn" onClick={() => setShowImport(true)}>⇪ Import line items</button>
      </div>

      {showImport && (
        <ImportDialog
          project={project}
          categories={categories}
          setCategories={setCategories}
          setItems={setItems}
          currency={currency}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}

function FragmentRow({
  item,
  open,
  rate,
  rates,
  currency,
  unitSystem,
  onToggle,
  onDelete,
  onFieldChange,
  onFieldBlur,
  onAddComponent,
  onRemoveComponent,
  onComponentChange,
  onSetRateMode,
  onFlatRateChange,
  onFlatRateBlur,
}: {
  item: LineItemRow;
  open: boolean;
  rate: number;
  rates: RateItemRow[];
  currency: string;
  unitSystem: UnitSystem;
  onToggle: () => void;
  onDelete: () => void;
  onFieldChange: (patch: Partial<LineItemRow>) => void;
  onFieldBlur: (patch: Partial<LineItemRow>) => void;
  onAddComponent: (key: BuildupKey) => void;
  onRemoveComponent: (key: BuildupKey, idx: number) => void;
  onComponentChange: (key: BuildupKey, idx: number, patch: Partial<BuildupComponent>) => void;
  onSetRateMode: (mode: "buildup" | "flat") => void;
  onFlatRateChange: (value: number) => void;
  onFlatRateBlur: (value: number) => void;
}) {
  const conv = convertedDisplay(item.unit, unitSystem);
  const rateMode = item.rate_mode || "buildup";

  return (
    <>
      <tr className={"item-row" + (open ? " open" : "")} onClick={onToggle}>
        <td>{item.description}</td>
        <td>{item.unit}</td>
        <td className="num mono">
          {numFmt.format(item.qty)}
          {conv && (
            <div style={{ fontSize: 10, color: "var(--ink-faint)", fontWeight: 400 }}>
              ≈ {numFmt.format(item.qty * conv.qtyMultiplier)} {conv.label}
            </div>
          )}
        </td>
        <td className="num mono">
          {formatMoney(rate, currency, 2)}
          {conv && (
            <div style={{ fontSize: 10, color: "var(--ink-faint)", fontWeight: 400 }}>
              ≈ {formatMoney(rate * conv.rateMultiplier, currency, 2)}/{conv.label}
            </div>
          )}
        </td>
        <td className="num mono">{formatMoney(rate * item.qty, currency)}</td>
        <td>
          <button
            className="btn btn-ghost btn-sm btn-danger"
            title="Remove line item"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            ✕
          </button>
        </td>
      </tr>
      {open && (
        <tr className="buildup-row" onClick={(e) => e.stopPropagation()}>
          <td colSpan={6}>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 10 }}>
              <div className="field">
                <label>Description</label>
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => onFieldChange({ description: e.target.value })}
                  onBlur={(e) => onFieldBlur({ description: e.target.value })}
                />
              </div>
              <div className="field" style={{ width: 90 }}>
                <label>Unit</label>
                <input
                  type="text"
                  value={item.unit}
                  onChange={(e) => onFieldChange({ unit: e.target.value })}
                  onBlur={(e) => onFieldBlur({ unit: e.target.value })}
                />
              </div>
              <div className="field" style={{ width: 120 }}>
                <label>Quantity</label>
                <input
                  type="number"
                  step="any"
                  value={item.qty}
                  onChange={(e) => onFieldChange({ qty: parseFloat(e.target.value) || 0 })}
                  onBlur={(e) => onFieldBlur({ qty: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input type="radio" name={`rate-mode-${item.id}`} checked={rateMode === "buildup"} onChange={() => onSetRateMode("buildup")} />
                Build up from labour / plant / material / subcontract
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input type="radio" name={`rate-mode-${item.id}`} checked={rateMode === "flat"} onChange={() => onSetRateMode("flat")} />
                Flat rate ($)
              </label>
            </div>

            {rateMode === "flat" ? (
              <div className="field" style={{ width: 160 }}>
                <label>Unit rate ({currency})</label>
                <input
                  type="number"
                  className="mono"
                  step="0.01"
                  value={item.flat_rate ?? 0}
                  onChange={(e) => onFlatRateChange(parseFloat(e.target.value) || 0)}
                  onBlur={(e) => onFlatRateBlur(parseFloat(e.target.value) || 0)}
                />
              </div>
            ) : (
              <div className="buildup-grid">
                <BuildupColumn title="Labour" comps={item.labour} rates={rates.filter((r) => r.kind === "labour")} currency={currency} onAdd={() => onAddComponent("labour")} onRemove={(idx) => onRemoveComponent("labour", idx)} onChange={(idx, patch) => onComponentChange("labour", idx, patch)} />
                <BuildupColumn title="Plant" comps={item.plant} rates={rates.filter((r) => r.kind === "plant")} currency={currency} onAdd={() => onAddComponent("plant")} onRemove={(idx) => onRemoveComponent("plant", idx)} onChange={(idx, patch) => onComponentChange("plant", idx, patch)} />
                <BuildupColumn title="Material" comps={item.material} rates={rates.filter((r) => r.kind === "material")} currency={currency} onAdd={() => onAddComponent("material")} onRemove={(idx) => onRemoveComponent("material", idx)} onChange={(idx, patch) => onComponentChange("material", idx, patch)} />
                <BuildupColumn title="Subcontract" comps={item.subcontract} rates={rates.filter((r) => r.kind === "subcontract")} currency={currency} onAdd={() => onAddComponent("subcontract")} onRemove={(idx) => onRemoveComponent("subcontract", idx)} onChange={(idx, patch) => onComponentChange("subcontract", idx, patch)} />
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function BuildupColumn({
  title,
  comps,
  rates,
  currency,
  onAdd,
  onRemove,
  onChange,
}: {
  title: string;
  comps: BuildupComponent[];
  rates: RateItemRow[];
  currency: string;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onChange: (idx: number, patch: Partial<BuildupComponent>) => void;
}) {
  return (
    <div className="buildup-col">
      <h5>
        <span>{title}</span>
        <button className="btn btn-ghost btn-sm" onClick={onAdd}>+ add</button>
      </h5>
      {comps.length === 0 && <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 6 }}>None</div>}
      {comps.map((c, idx) => {
        const r = rateById(rates, c.ref);
        const cost = (r?.rate || 0) * (c.perUnit || 0);
        return (
          <div className="comp-row" key={idx}>
            <select value={c.ref} onChange={(e) => onChange(idx, { ref: e.target.value })}>
              {rates.map((rr) => (
                <option key={rr.id} value={rr.id}>{rr.name}</option>
              ))}
            </select>
            <input
              type="number"
              className="mono"
              step="any"
              value={c.perUnit}
              title="Qty per unit"
              onChange={(e) => onChange(idx, { perUnit: parseFloat(e.target.value) || 0 })}
            />
            <div className="comp-cost mono">{formatMoney(cost, currency, 2)}</div>
            <button className="btn btn-ghost btn-sm btn-danger" onClick={() => onRemove(idx)}>✕</button>
          </div>
        );
      })}
    </div>
  );
}
