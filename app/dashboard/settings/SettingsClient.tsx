"use client";

import { useState } from "react";
import type { OrganizationRow } from "@/lib/types";
import { CURRENCIES } from "@/lib/units";
import { updateOrgSettings } from "./actions";

export default function SettingsClient({ org, saved }: { org: OrganizationRow; saved: boolean }) {
  const [name, setName] = useState(org.name);
  const [currency, setCurrency] = useState(org.currency || "AUD");
  const [unitSystem, setUnitSystem] = useState(org.unit_system || "metric");

  return (
    <div>
      <div className="titleblock">
        <div>
          <h2>Settings</h2>
          <div className="meta">Workspace-wide preferences — currency and unit of measure.</div>
        </div>
      </div>

      {saved && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 13px",
            borderRadius: 8,
            background: "rgba(31,111,160,0.08)",
            border: "1px solid var(--blueprint)",
            color: "var(--blueprint)",
            fontSize: 14,
          }}
        >
          Settings saved.
        </div>
      )}

      <div className="card" style={{ padding: "22px 24px", maxWidth: 520 }}>
        <form action={updateOrgSettings}>
          <div className="field" style={{ marginBottom: 16 }}>
            <label htmlFor="name">Workspace name</label>
            <input id="name" name="name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label htmlFor="currency">Currency</label>
            <select id="currency" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label} ({c.code}, {c.symbol})
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 20 }}>
            <label>Unit of measure</label>
            <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
                <input
                  type="radio"
                  name="unit_system"
                  value="metric"
                  checked={unitSystem === "metric"}
                  onChange={() => setUnitSystem("metric")}
                />
                Metric (m, m³, tonne)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
                <input
                  type="radio"
                  name="unit_system"
                  value="imperial"
                  checked={unitSystem === "imperial"}
                  onChange={() => setUnitSystem("imperial")}
                />
                Imperial (ft, cu yd, ton)
              </label>
            </div>
          </div>

          <button type="submit" className="btn btn-primary">
            Save settings
          </button>
        </form>
      </div>

      <div className="note" style={{ marginTop: 22 }}>
        <span>⚠</span>
        <span>
          <b>How this works.</b> Currency changes how every dollar figure in the app is
          formatted. Unit of measure sets your default — rates and quantities keep whatever
          unit you actually typed, and a small converted equivalent is shown alongside any row
          whose unit is in the other system, so nothing you've already entered changes.
        </span>
      </div>
    </div>
  );
}
