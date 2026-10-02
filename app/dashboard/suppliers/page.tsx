import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SupplierRow } from "@/lib/types";
import SuppliersClient from "./SuppliersClient";

export default async function SuppliersPage() {
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

  if (!membership) {
    return <div className="empty">No workspace found for this account.</div>;
  }

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*")
    .eq("org_id", membership.org_id)
    .order("legal_name");

  return <SuppliersClient orgId={membership.org_id} initialSuppliers={(suppliers || []) as SupplierRow[]} />;
}
