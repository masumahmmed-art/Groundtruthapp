import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CategoryRow, LineItemRow, ProjectRow, RateItemRow, RiskItemRow } from "@/lib/types";
import EstimatorClient from "./EstimatorClient";

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase.from("projects").select("*").eq("id", params.id).single();
  if (!project) notFound(); // RLS returns no row if this user's org doesn't own it

  const [{ data: categories }, { data: rateItems }, { data: riskItems }] = await Promise.all([
    supabase.from("categories").select("*").eq("project_id", params.id).order("sort_order"),
    supabase.from("rate_items").select("*").eq("org_id", project.org_id).order("sort_order"),
    supabase.from("risk_items").select("*").eq("project_id", params.id).order("sort_order"),
  ]);

  const catIds = (categories || []).map((c) => c.id);
  let lineItems: LineItemRow[] = [];
  if (catIds.length) {
    const { data } = await supabase.from("line_items").select("*").in("category_id", catIds).order("sort_order");
    lineItems = (data || []) as LineItemRow[];
  }

  return (
    <EstimatorClient
      project={project as ProjectRow}
      initialCategories={(categories || []) as CategoryRow[]}
      initialItems={lineItems}
      initialRisks={(riskItems || []) as RiskItemRow[]}
      rates={(rateItems || []) as RateItemRow[]}
    />
  );
}
