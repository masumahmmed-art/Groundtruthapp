"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SupplierRow, SupplierType } from "@/lib/types";

export const SUPPLIER_TYPE_LABELS: Record<SupplierType, string> = {
  plant_hire: "Plant hire",
  materials: "Materials",
  subcontractor: "Subcontractor",
  consultant: "Consultant",
  other: "Other",
};

const EXPIRY_WARNING_DAYS = 30;

/** Strips spaces and anything that isn't a digit. */
function cleanAbn(value: string): string {
  return value.replace(/\D/g, "");
}

/** Formats an 11-digit ABN the way it's printed on invoices: 51 824 753 556. */
export function formatAbn(abn: string): string {
  const d = cleanAbn(abn);
  if (d.length !== 11) return abn;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
}

/** Same ATO checksum the database enforces, so the form can say so before saving. */
function isValidAbn(abn: string): boolean {
  if (!/^\d{11}$/.test(abn)) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  let total = 0;
  for (let i = 0; i < 11; i++) {
    let d = Number(abn[i]);
    if (i === 0) d -= 1;
    total += d * weights[i];
  }
  return total % 89 === 0;
}

type ExpiryState = "expired" | "soon" | "ok" | "none";

function expiryState(date: string | null): ExpiryState {
  if (!date) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date + "T00:00:00");
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (days < 0) return "expired";
  if (days <= EXPIRY_WARNING_DAYS) return "soon";
  return "ok";
}

function ExpiryFlag({ date }: { date: string | null }) {
  const state = expiryState(date);
  if (state === "expired") return <div style={{ fontSize: 10.5, color: "var(--danger)", marginTop: 2, fontWeight: 600 }}>Expired</div>;
  if (state === "soon") return <div style={{ fontSize: 10.5, color: "var(--warning)", marginTop: 2, fontWeight: 600 }}>Expires within {EXPIRY_WARNING_DAYS} days</div>;
  return null;
}

interface LookupResult {
  valid: boolean;
  lookedUp?: boolean;
  abn?: string;
  status?: string | null;
  entityName?: string;
  businessNames?: string[];
  gstRegistered?: boolean;
  state?: string;
  postcode?: string;
  checkedAt?: string;
  error?: string;
}

export default function SuppliersClient({
  orgId,
  initialSuppliers,
}: {
  orgId: string;
  initialSuppliers: SupplierRow[];
}) {
  const supabase = createClient();
  const [suppliers, setSuppliers] = useState<SupplierRow[]>(initialSuppliers);
  const [showInactive, setShowInactive] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // --- New supplier form ---
  const [abnInput, setAbnInput] = useState("");
  const [newType, setNewType] = useState<SupplierType>("subcontractor");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [legalName, setLegalName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const abnDigits = cleanAbn(abnInput);
  const abnLooksValid = isValidAbn(abnDigits);
  const duplicate = suppliers.find((s) => s.abn === abnDigits);

  async function runLookup() {
    setFormError("");
    setLookup(null);
    if (!abnLooksValid) {
      setFormError("That isn't a valid ABN — check the 11 digits.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("abn-lookup", { body: { abn: abnDigits } });
    setBusy(false);
    if (error) {
      setFormError("Couldn't reach ABN Lookup. You can still add the supplier and type the name yourself.");
      return;
    }
    const result = data as LookupResult;
    setLookup(result);
    if (result.lookedUp) {
      setLegalName(result.entityName || "");
      setTradingName(result.businessNames?.[0] || "");
    }
  }

  async function addSupplier(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!abnLooksValid) {
      setFormError("That isn't a valid ABN — check the 11 digits.");
      return;
    }
    if (duplicate) {
      setFormError(`This ABN is already in your register as ${duplicate.legal_name || duplicate.trading_name || "a supplier"}.`);
      return;
    }
    if (!legalName.trim() && !tradingName.trim()) {
      setFormError("Enter a name, or look the ABN up to fill it in.");
      return;
    }
    const looked = lookup?.lookedUp ? lookup : null;
    setBusy(true);
    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        org_id: orgId,
        abn: abnDigits,
        legal_name: legalName.trim(),
        trading_name: tradingName.trim(),
        supplier_type: newType,
        gst_registered: looked ? !!looked.gstRegistered : null,
        abn_status: looked ? looked.status ?? null : null,
        abn_checked_at: looked ? looked.checkedAt ?? new Date().toISOString() : null,
        address: looked && (looked.state || looked.postcode) ? [looked.state, looked.postcode].filter(Boolean).join(" ") : "",
      })
      .select("*")
      .single();
    setBusy(false);
    if (error || !data) {
      setFormError(error?.message || "Couldn't save the supplier.");
      return;
    }
    setSuppliers((prev) => [...prev, data as SupplierRow].sort((a, b) => displayName(a).localeCompare(displayName(b))));
    setAbnInput("");
    setLegalName("");
    setTradingName("");
    setLookup(null);
  }

  // --- Editing existing suppliers ---
  function update(id: string, patch: Partial<SupplierRow>) {
    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  async function persist(id: string, patch: Partial<SupplierRow>) {
    await supabase.from("suppliers").update(patch).eq("id", id);
  }
  function setField(id: string, patch: Partial<SupplierRow>) {
    update(id, patch);
    persist(id, patch);
  }

  async function recheck(s: SupplierRow) {
    const { data, error } = await supabase.functions.invoke("abn-lookup", { body: { abn: s.abn } });
    const result = data as LookupResult | null;
    if (error || !result) {
      alert("Couldn't reach ABN Lookup right now.");
      return;
    }
    if (!result.lookedUp) {
      alert(result.error || "ABN Lookup didn't return details for this ABN.");
      return;
    }
    setField(s.id, {
      gst_registered: !!result.gstRegistered,
      abn_status: result.status ?? null,
      abn_checked_at: result.checkedAt ?? new Date().toISOString(),
      legal_name: s.legal_name || result.entityName || "",
    });
  }

  async function remove(s: SupplierRow) {
    const ok = confirm(
      `Remove ${displayName(s)}? Costs already linked to them stay, but lose the link. ` +
        `To keep the history, untick "Active" instead.`
    );
    if (!ok) return;
    setSuppliers((prev) => prev.filter((x) => x.id !== s.id));
    await supabase.from("suppliers").delete().eq("id", s.id);
  }

  const visible = useMemo(
    () => suppliers.filter((s) => showInactive || s.is_active),
    [suppliers, showInactive]
  );
  const attention = suppliers.filter(
    (s) =>
      s.is_active &&
      (["expired", "soon"].includes(expiryState(s.insurance_expiry)) ||
        ["expired", "soon"].includes(expiryState(s.licence_expiry)) ||
        (s.abn_status && s.abn_status !== "Active"))
  ).length;

  return (
    <div>
      <div className="titleblock">
        <div>
          <h2>Suppliers</h2>
          <div className="meta">
            Plant hire, material suppliers and subcontractors, registered by ABN. Shared across every project in your workspace.
          </div>
        </div>
        <div className="stamp">
          {suppliers.filter((s) => s.is_active).length} active
          {attention > 0 && (
            <>
              <br />
              <span style={{ color: "var(--warning)" }}>{attention} need attention</span>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 24 }}>
        <form onSubmit={addSupplier}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="field" style={{ flex: "0 1 220px" }}>
              <label>ABN</label>
              <input
                type="text"
                inputMode="numeric"
                className="mono"
                value={abnInput}
                onChange={(e) => {
                  setAbnInput(e.target.value);
                  setLookup(null);
                  setFormError("");
                }}
                placeholder="e.g. 51 824 753 556"
              />
            </div>
            <button type="button" className="btn" onClick={runLookup} disabled={busy || abnDigits.length !== 11}>
              {busy ? "Checking…" : "Look up ABN"}
            </button>
            <div className="field" style={{ flex: "0 1 170px" }}>
              <label>Type</label>
              <select value={newType} onChange={(e) => setNewType(e.target.value as SupplierType)}>
                {Object.entries(SUPPLIER_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {abnDigits.length === 11 && !abnLooksValid && (
            <div className="hint" style={{ color: "var(--danger)", marginTop: 8 }}>
              That ABN fails the ATO checksum, so it can't be right. Check the digits.
            </div>
          )}
          {duplicate && (
            <div className="hint" style={{ color: "var(--warning)", marginTop: 8 }}>
              Already in your register as {displayName(duplicate)}.
            </div>
          )}
          {lookup && !lookup.lookedUp && lookup.valid && (
            <div className="hint" style={{ marginTop: 8 }}>
              The ABN is valid, but details couldn't be fetched{lookup.error ? ` (${lookup.error})` : ""}. Type the name below.
            </div>
          )}
          {lookup?.lookedUp && (
            <div className="note" style={{ marginTop: 12, marginBottom: 0 }}>
              <span>✓</span>
              <span>
                <b>{lookup.entityName}</b> — ABN {lookup.status?.toLowerCase() || "status unknown"},{" "}
                {lookup.gstRegistered ? "registered for GST" : "not registered for GST"}
                {lookup.state ? `, ${lookup.state} ${lookup.postcode || ""}` : ""}.
                {lookup.status && lookup.status !== "Active" && (
                  <> This ABN is not active — check before paying them.</>
                )}
              </span>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12 }}>
            <div className="field" style={{ flex: "1 1 260px" }}>
              <label>Legal name</label>
              <input type="text" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="As registered on the ABN" />
            </div>
            <div className="field" style={{ flex: "1 1 220px" }}>
              <label>Trading name (optional)</label>
              <input type="text" value={tradingName} onChange={(e) => setTradingName(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy || !abnLooksValid || !!duplicate}>
              Add supplier
            </button>
          </div>
          {formError && <div className="hint" style={{ color: "var(--danger)", marginTop: 8 }}>{formError}</div>}
        </form>
      </div>

      <div className="section">
        <div className="section-head">
          <h3>Register</h3>
          <label className="hint" style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show inactive
          </label>
        </div>
        <div className="card rate-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th style={{ width: 140 }}>ABN</th>
                <th style={{ width: 140 }}>Type</th>
                <th style={{ width: 70 }}>GST</th>
                <th style={{ width: 150 }}>Insurance expiry</th>
                <th style={{ width: 150 }}>Licence expiry</th>
                <th className="num" style={{ width: 90 }}>Terms (days)</th>
                <th style={{ width: 60 }}>Active</th>
                <th style={{ width: 70 }}></th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty">
                    No suppliers yet. Add one above by ABN.
                  </td>
                </tr>
              )}
              {visible.map((s) => (
                <SupplierRows
                  key={s.id}
                  s={s}
                  expanded={expanded === s.id}
                  onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
                  update={update}
                  persist={persist}
                  setField={setField}
                  recheck={recheck}
                  remove={remove}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="hint" style={{ marginTop: 10 }}>
          Insurance and licence dates turn amber {EXPIRY_WARNING_DAYS} days before expiry and red once expired. Link
          costs to a supplier on each project's Actuals tab.
        </div>
      </div>
    </div>
  );
}

export function displayName(s: Pick<SupplierRow, "legal_name" | "trading_name" | "abn">): string {
  return s.trading_name || s.legal_name || `ABN ${formatAbn(s.abn)}`;
}

function SupplierRows({
  s,
  expanded,
  onToggle,
  update,
  persist,
  setField,
  recheck,
  remove,
}: {
  s: SupplierRow;
  expanded: boolean;
  onToggle: () => void;
  update: (id: string, patch: Partial<SupplierRow>) => void;
  persist: (id: string, patch: Partial<SupplierRow>) => void;
  setField: (id: string, patch: Partial<SupplierRow>) => void;
  recheck: (s: SupplierRow) => void;
  remove: (s: SupplierRow) => void;
}) {
  const textField = (key: "email" | "phone" | "address" | "licence_number" | "notes" | "legal_name" | "trading_name", label: string) => (
    <div className="field" style={{ flex: "1 1 220px" }}>
      <label>{label}</label>
      <input
        type="text"
        value={s[key]}
        onChange={(e) => update(s.id, { [key]: e.target.value } as Partial<SupplierRow>)}
        onBlur={(e) => persist(s.id, { [key]: e.target.value } as Partial<SupplierRow>)}
      />
    </div>
  );

  return (
    <>
      <tr style={{ opacity: s.is_active ? 1 : 0.55 }}>
        <td>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onToggle} title="Show details" style={{ marginRight: 6 }}>
            {expanded ? "▾" : "▸"}
          </button>
          <b>{displayName(s)}</b>
          {s.trading_name && s.legal_name && s.trading_name !== s.legal_name && (
            <div className="hint" style={{ marginLeft: 34 }}>{s.legal_name}</div>
          )}
        </td>
        <td className="mono">
          {formatAbn(s.abn)}
          {s.abn_status && s.abn_status !== "Active" && (
            <div style={{ fontSize: 10.5, color: "var(--danger)", fontWeight: 600 }}>ABN {s.abn_status.toLowerCase()}</div>
          )}
        </td>
        <td>
          <select value={s.supplier_type} onChange={(e) => setField(s.id, { supplier_type: e.target.value as SupplierType })}>
            {Object.entries(SUPPLIER_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </td>
        <td title={s.abn_checked_at ? `Checked ${new Date(s.abn_checked_at).toLocaleDateString()}` : "Not checked against the ABR"}>
          {s.gst_registered === null ? "—" : s.gst_registered ? "Yes" : "No"}
        </td>
        <td>
          <input type="date" value={s.insurance_expiry || ""} onChange={(e) => setField(s.id, { insurance_expiry: e.target.value || null })} />
          <ExpiryFlag date={s.insurance_expiry} />
        </td>
        <td>
          <input type="date" value={s.licence_expiry || ""} onChange={(e) => setField(s.id, { licence_expiry: e.target.value || null })} />
          <ExpiryFlag date={s.licence_expiry} />
        </td>
        <td className="num">
          <input
            type="number"
            className="mono"
            min={0}
            step={1}
            value={s.payment_terms_days}
            onChange={(e) => update(s.id, { payment_terms_days: parseInt(e.target.value) || 0 })}
            onBlur={(e) => persist(s.id, { payment_terms_days: parseInt(e.target.value) || 0 })}
          />
        </td>
        <td>
          <input type="checkbox" checked={s.is_active} onChange={(e) => setField(s.id, { is_active: e.target.checked })} />
        </td>
        <td>
          <button className="btn btn-ghost btn-sm btn-danger" title="Remove supplier" onClick={() => remove(s)}>
            ✕
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} style={{ background: "var(--surface-2, transparent)" }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "8px 0" }}>
              {textField("legal_name", "Legal name")}
              {textField("trading_name", "Trading name")}
              {textField("email", "Accounts email")}
              {textField("phone", "Phone")}
              {textField("address", "Address")}
              {textField("licence_number", "Licence number")}
              {textField("notes", "Notes")}
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", paddingBottom: 6 }}>
              <button type="button" className="btn btn-sm" onClick={() => recheck(s)}>
                Re-check ABN and GST status
              </button>
              <span className="hint">
                {s.abn_checked_at
                  ? `Last checked against the Australian Business Register on ${new Date(s.abn_checked_at).toLocaleDateString()}.`
                  : "Not yet checked against the Australian Business Register."}
              </span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
