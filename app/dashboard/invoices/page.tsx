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

  // Which submitted invoices this person can act on (project check or approval).
  const awaiting = ((invoices || []) as SupplierInvoiceRow[]).filter(
    (i) => i.status === "awaiting_check" || i.status === "awaiting_approval"
  );
  const permissions = await Promise.all(
    awaiting.map((i) =>
      supabase.rpc(i.status === "awaiting_check" ? "can_check_supplier_invoice" : "can_approve_supplier_invoice", {
        p_invoice_id: i.id,
      })
    )
  );
  const actionableIds = awaiting.filter((_, idx) => permissions[idx].data === true).map((i) => i.id);

  return (
    <InvoicesClient
      orgId={membership.org_id}
      initialInvoices={(invoices || []) as SupplierInvoiceRow[]}
      suppliers={(suppliers || []) as SupplierRow[]}
      initialAllowance={allowance}
      actionableIds={actionableIds}
    />
  );
}
