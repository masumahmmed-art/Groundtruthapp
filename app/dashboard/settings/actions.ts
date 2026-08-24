"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateOrgSettings(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) throw new Error("No organization found for this account.");

  const name = String(formData.get("name") || "").trim();
  const currency = String(formData.get("currency") || "AUD");
  const unitSystem = String(formData.get("unit_system") || "metric");

  const patch: Record<string, string> = { currency, unit_system: unitSystem };
  if (name) patch.name = name;

  const { error } = await supabase.from("organizations").update(patch).eq("id", membership.org_id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/settings?saved=1");
}
