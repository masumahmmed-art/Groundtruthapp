"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type {
  ActualCostRow,
  ActualHoursRow,
  CategoryRow,
  LineItemRow,
  Markups,
  PositionRow,
  ProjectRow,
  RateItemRow,
  RiskItemRow,
} from "@/lib/types";
import { fullBuildup } from "@/lib/calc";
import { formatMoney } from "@/lib/units";
import { useOrgSettings } from "@/lib/OrgSettingsContext";
import ProjectTab from "./ProjectTab";
import EstimateTab from "./EstimateTab";
import RiskTab from "./RiskTab";
import SummaryTab from "./SummaryTab";
import ProgrammeTab from "./ProgrammeTab";
import PositionsTab from "./PositionsTab";
import ActualsTab from "./ActualsTab";
import EarnedValueTab from "./EarnedValueTab";
import DashboardTab from "./DashboardTab";

// Tabs are grouped into two modes, reflecting the two things this app is
// used for at different times: putting together the tender price (Estimate)
// versus tracking real progress and cost once the job is under way (Cost
// Control). The group switcher above the tab row picks which set shows —
// with 8 tabs in one flat row, it got hard to scan; splitting them by when
// you'd actually use each one keeps each row short and purposeful.
const TAB_GROUPS = [
  {
    id: "estimate",
    label: "Estimate",
    tabs: [
      { id: "project", label: "Project" },
      { id: "estimate", label: "Estimate" },
      { id: "risk", label: "Risk & Location" },
      { id: "summary", label: "Summary" },
      { id: "dashboard", label: "Dashboard" },
    ],
  },
  {
    id: "cost-control",
    label: "Cost Control",
    tabs: [
      { id: "programme", label: "Programme" },
      { id: "positions", label: "Positions" },
      { id: "actuals", label: "Actuals" },
      { id: "earned-value", label: "Earned Value" },
    ],
  },
] as const;

type TabId = (typeof TAB_GROUPS)[number]["tabs"][number]["id"];
type GroupId = (typeof TAB_GROUPS)[number]["id"];

function groupOf(tabId: TabId): GroupId {
  return (TAB_GROUPS.find((g) => g.tabs.some((t) => t.id === tabId)) || TAB_GROUPS[0]).id;
}

export default function EstimatorClient({
  project: initialProject,
  initialCategories,
  initialItems,
  initialRisks,
  initialPositions,
  initialActualCosts,
  initialActualHours,
  rates,
}: {
  project: ProjectRow;
  initialCategories: CategoryRow[];
  initialItems: LineItemRow[];
  initialRisks: RiskItemRow[];
  initialPositions: PositionRow[];
  initialActualCosts: ActualCostRow[];
  initialActualHours: ActualHoursRow[];
  rates: RateItemRow[];
}) {
  const { currency, unitSystem } = useOrgSettings();
  const [activeTab, setActiveTab] = useState<TabId>("project");
  // Remembers which tab was last open in each group, so switching from
  // Estimate to Cost Control and back doesn't lose your place — e.g. if
  // you're on the Actuals tab, switching to Estimate and back to Cost
  // Control returns you to Actuals rather than resetting to Programme.
  const [lastTabByGroup, setLastTabByGroup] = useState<Record<GroupId, TabId>>({
    estimate: "project",
    "cost-control": "programme",
  });
  const activeGroup = groupOf(activeTab);
  function selectTab(id: TabId) {
    setActiveTab(id);
    setLastTabByGroup((prev) => ({ ...prev, [groupOf(id)]: id }));
  }
  function selectGroup(id: GroupId) {
    if (id === activeGroup) return;
    setActiveTab(lastTabByGroup[id]);
  }
  const [project, setProject] = useState(initialProject);
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);
  const [risks, setRisks] = useState(initialRisks);
  const [positions, setPositions] = useState(initialPositions);
  const [actualCosts, setActualCosts] = useState(initialActualCosts);
  const [actualHours, setActualHours] = useState(initialActualHours);

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

      <div className="tab-groups">
        {TAB_GROUPS.map((g) => (
          <button key={g.id} className={activeGroup === g.id ? "active" : ""} onClick={() => selectGroup(g.id)}>
            {g.label}
          </button>
        ))}
      </div>
      <div className="tabs">
        {TAB_GROUPS.find((g) => g.id === activeGroup)!.tabs.map((t) => (
          <button key={t.id} className={activeTab === t.id ? "active" : ""} onClick={() => selectTab(t.id)}>
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
      {activeTab === "programme" && (
        <ProgrammeTab
          project={project}
          categories={categories}
          setCategories={setCategories}
          items={items}
          rates={rates}
          currency={currency}
        />
      )}
      {activeTab === "positions" && (
        <PositionsTab project={project} positions={positions} setPositions={setPositions} currency={currency} />
      )}
      {activeTab === "actuals" && (
        <ActualsTab
          project={project}
          categories={categories}
          items={items}
          positions={positions}
          actualCosts={actualCosts}
          setActualCosts={setActualCosts}
          actualHours={actualHours}
          setActualHours={setActualHours}
          rates={rates}
          currency={currency}
        />
      )}
      {activeTab === "earned-value" && (
        <EarnedValueTab
          categories={categories}
          items={items}
          setItems={setItems}
          positions={positions}
          actualCosts={actualCosts}
          actualHours={actualHours}
          rates={rates}
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
