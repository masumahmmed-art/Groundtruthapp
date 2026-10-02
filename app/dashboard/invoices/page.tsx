import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceReadAllowance, SupplierInvoiceRow, SupplierRow } from "@/lib/types";
import InvoicesClient from "./InvoicesClient";

export default async function InvoicesPage() {
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

  const [{ data: invoices }, { data: suppliers }, { data: allowanceRows }] = await Promise.all([
    supabase
      .from("supplier_invoices")
      .select("*")
      .eq("org_id", membership.org_id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("suppliers").select("*").eq("org_id", membership.org_id),
    supabase.rpc("invoice_read_allowance", { p_org_id: membership.org_id }),
  ]);

  const allowance = (Array.isArray(allowanceRows) ? allowanceRows[0] : null) as InvoiceReadAllowance | null;

  return (
    <InvoicesClient
      orgId={membership.org_id}
      initialInvoices={(invoices || []) as SupplierInvoiceRow[]}
      suppliers={(suppliers || []) as SupplierRow[]}
      initialAllowance={allowance}
    />
  );
}
