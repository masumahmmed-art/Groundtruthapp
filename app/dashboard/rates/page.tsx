import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RateItemRow } from "@/lib/types";
import RatesClient from "./RatesClient";

export default async function RatesPage() {
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

  const { data: rateItems } = await supabase
    .from("rate_items")
    .select("*")
    .eq("org_id", membership.org_id)
    .order("sort_order");

  return <RatesClient orgId={membership.org_id} initialRates={(rateItems || []) as RateItemRow[]} />;
}
