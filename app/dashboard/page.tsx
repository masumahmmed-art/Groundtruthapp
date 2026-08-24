import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createBlankProject, createExampleProject, deleteProject } from "./actions";
import { fullBuildup } from "@/lib/calc";
import { formatMoney } from "@/lib/units";
import type { LineItemRow, Markups, ProjectRow, RateItemRow, RiskItemRow } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("organizations(currency)")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  const currency = (membership as any)?.organizations?.currency || "AUD";

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  const projectRows = (projects || []) as ProjectRow[];

  const totals: Record<string, number> = {};
  if (projectRows.length) {
    const { data: rateItems } = await supabase.from("rate_items").select("*");
    const rates = (rateItems || []) as RateItemRow[];

    for (const p of projectRows) {
      const { data: cats } = await supabase.from("categories").select("id").eq("project_id", p.id);
      const catIds = (cats || []).map((c) => c.id);
      let items: LineItemRow[] = [];
      let risks: RiskItemRow[] = [];
      if (catIds.length) {
        const { data: li } = await supabase.from("line_items").select("*").in("category_id", catIds);
        items = (li || []) as LineItemRow[];
      }
      const { data: ri } = await supabase.from("risk_items").select("*").eq("project_id", p.id);
      risks = (ri || []) as RiskItemRow[];
      totals[p.id] = fullBuildup(rates, items, p.markups as Markups, risks).totalProjectCost;
    }
  }

  return (
    <div>
      <div className="titleblock">
        <div>
          <h2>Projects</h2>
          <div className="meta">Every estimate in your workspace.</div>
        </div>
      </div>

      <div className="section" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <form action={createBlankProject} style={{ display: "flex", gap: 8 }}>
          <input type="text" name="name" placeholder="New project name" style={{ minWidth: 220 }} />
          <button type="submit" className="btn btn-primary">
            + New project
          </button>
        </form>
        <form action={createExampleProject}>
          <button type="submit" className="btn">
            Load example project
          </button>
        </form>
      </div>

      <div className="card rate-table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: "40%" }}>Project</th>
              <th>Client</th>
              <th>Location</th>
              <th className="num">Total project cost</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {projectRows.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  No projects yet — create a blank one or load the example project to see the estimator in action.
                </td>
              </tr>
            )}
            {projectRows.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/dashboard/projects/${p.id}`}>{p.name}</Link>
                </td>
                <td>{p.client || "—"}</td>
                <td>{p.location || "—"}</td>
                <td className="num mono">{formatMoney(totals[p.id] || 0, currency)}</td>
                <td>
                  <form action={deleteProject}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className="btn btn-ghost btn-sm btn-danger" title="Delete project">
                      ✕
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
