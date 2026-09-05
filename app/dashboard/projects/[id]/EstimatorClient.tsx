"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CategoryRow, LineItemRow, Markups, ProjectRow, RateItemRow, RiskItemRow } from "@/lib/types";
import { fullBuildup } from "@/lib/calc";
import { formatMoney } from "@/lib/units";
import { useOrgSettings } from "@/lib/OrgSettingsContext";
import ProjectTab from "./ProjectTab";
import EstimateTab from "./EstimateTab";
import RiskTab from "./RiskTab";
import SummaryTab from "./SummaryTab";
import DashboardTab from "./DashboardTab";

const TABS = [
  { id: "project", label: "Project" },
  { id: "estimate", label: "Estimate" },
  { id: "risk", label: "Risk & Location" },
  { id: "summary", label: "Summary" },
  { id: "dashboard", label: "Dashboard" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function EstimatorClient({
  project: initialProject,
  initialCategories,
  initialItems,
  initialRisks,
  rates,
}: {
  project: ProjectRow;
  initialCategories: CategoryRow[];
  initialItems: LineItemRow[];
  initialRisks: RiskItemRow[];
  rates: RateItemRow[];
}) {
  const { currency, unitSystem } = useOrgSettings();
  const [activeTab, setActiveTab] = useState<TabId>("project");
  const [project, setProject] = useState(initialProject);
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);
  const [risks, setRisks] = useState(initialRisks);

  const build = useMemo(
    () => fullBuildup(rates, items, project.markups as Markups, risks),
    [rates, items, project.markups, risks]
  );

  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <Link href="/dashboard" style={{ fontSize: 12.5, color: "var(--ink-faint)", textDecoration: "none" }}>
          ← All projects
        </Link>
      </div>

      <div className="titleblock" style={{ marginBottom: 8, borderBottom: "none", paddingBottom: 0 }}>
        <div>
          <h2 style={{ fontSize: 22 }}>{project.name}</h2>
          <div className="meta">
            {project.client || "No client set"} · {project.location || "No location set"}
          </div>
        </div>
        <div className="stamp">
          Total project cost
          <br />
          <span className="mono" style={{ fontSize: 16, color: "var(--ink)" }}>
            {formatMoney(build.totalProjectCost, currency)}
          </span>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={activeTab === t.id ? "active" : ""} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "project" && <ProjectTab project={project} setProject={setProject} />}
      {activeTab === "estimate" && (
        <EstimateTab
          project={project}
          categories={categories}
          setCategories={setCategories}
          items={items}
          setItems={setItems}
          rates={rates}
          currency={currency}
          unitSystem={unitSystem}
        />
      )}
      {activeTab === "risk" && (
        <RiskTab project={project} risks={risks} setRisks={setRisks} currency={currency} />
      )}
      {activeTab === "summary" && (
        <SummaryTab
          project={project}
          setProject={setProject}
          categories={categories}
          items={items}
          risks={risks}
          rates={rates}
          build={build}
          currency={currency}
        />
      )}
      {activeTab === "dashboard" && (
        <DashboardTab
          project={project}
          categories={categories}
          setCategories={setCategories}
          items={items}
          risks={risks}
          rates={rates}
          build={build}
          currency={currency}
        />
      )}
    </div>
  );
}
