import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrganizationRow } from "@/lib/types";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { saved?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("organizations(id, name, currency, unit_system, created_at)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const org = (membership as any)?.organizations as OrganizationRow | undefined;
  if (!org) {
    return <div className="empty">No workspace found for this account.</div>;
  }

  return <SettingsClient org={org} saved={!!searchParams.saved} />;
}
