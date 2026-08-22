"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function currentOrgId(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user!.id)
    .limit(1)
    .single();

  if (!membership) throw new Error("No organization found for this account.");
  return { orgId: membership.org_id as string, userId: user!.id };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createBlankProject(formData: FormData) {
  const name = String(formData.get("name") || "New Project").trim() || "New Project";
  const supabase = createClient();
  const { orgId, userId } = await currentOrgId(supabase);

  const { data: project, error } = await supabase
    .from("projects")
    .insert({ org_id: orgId, name, created_by: userId })
    .select("id")
    .single();

  if (error || !project) throw new Error(error?.message || "Could not create project");

  const defaultCategories = [
    { name: "Earthworks & Site Works", color: "var(--cat-earth)", sort_order: 1 },
    { name: "Roads & Pavements", color: "var(--cat-pave)", sort_order: 2 },
    { name: "Drainage & Pipelines", color: "var(--cat-drain)", sort_order: 3 },
    { name: "Structures (Bridges & Culverts)", color: "var(--cat-struct)", sort_order: 4 },
  ];
  await supabase.from("categories").insert(defaultCategories.map((c) => ({ ...c, project_id: project.id })));

  revalidatePath("/dashboard");
  redirect(`/dashboard/projects/${project.id}`);
}

export async function createExampleProject() {
  const supabase = createClient();
  const { orgId, userId } = await currentOrgId(supabase);

  const { data: projectId, error } = await supabase.rpc("seed_example_project", {
    p_org_id: orgId,
    p_created_by: userId,
  });

  if (error || !projectId) throw new Error(error?.message || "Could not create example project");

  revalidatePath("/dashboard");
  redirect(`/dashboard/projects/${projectId}`);
}

export async function deleteProject(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = createClient();
  await supabase.from("projects").delete().eq("id", id);
  revalidatePath("/dashboard");
}
