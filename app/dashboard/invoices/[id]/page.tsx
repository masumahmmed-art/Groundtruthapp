import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  CategoryRow,
  InvoiceApprovalMode,
  InvoiceEventRow,
  ProjectRow,
  SupplierInvoiceLineRow,
  SupplierInvoiceRow,
  SupplierRow,
  TeamMember,
} from "@/lib/types";
import ReviewClient from "./ReviewClient";

export default async function InvoiceReviewPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: invoice } = await supabase.from("supplier_invoices").select("*").eq("id", params.id).single();
  if (!invoice) notFound(); // RLS hides other workspaces' invoices

  const inv = invoice as SupplierInvoiceRow;
  const [{ data: lines }, { data: suppliers }, { data: projects }, { data: signed }, { data: others }] = await Promise.all([
    supabase.from("supplier_invoice_lines").select("*").eq("invoice_id", inv.id).order("sort_order"),
    supabase.from("suppliers").select("*").eq("org_id", inv.org_id).order("legal_name"),
    supabase.from("projects").select("*").eq("org_id", inv.org_id).order("name"),
    supabase.storage.from("invoices").createSignedUrl(inv.file_path, 60 * 60),
    supabase
      .from("supplier_invoices")
      .select("*")
      .eq("org_id", inv.org_id)
      .neq("id", inv.id)
      .neq("status", "rejected")
      .neq("invoice_number", ""),
  ]);

  const [{ data: org }, { data: team }, { data: events }, { data: canCheck }, { data: canApprove }] = await Promise.all([
    supabase.from("organizations").select("invoice_approval_mode").eq("id", inv.org_id).single(),
    supabase.rpc("org_member_list", { p_org_id: inv.org_id }),
    supabase.from("invoice_events").select("*").eq("invoice_id", inv.id).order("created_at"),
    supabase.rpc("can_check_supplier_invoice", { p_invoice_id: inv.id }),
    supabase.rpc("can_approve_supplier_invoice", { p_invoice_id: inv.id }),
  ]);

  const projectIds = (projects || []).map((p) => p.id);
  let categories: CategoryRow[] = [];
  if (projectIds.length) {
    const { data } = await supabase.from("categories").select("*").in("project_id", projectIds).order("sort_order");
    categories = (data || []) as CategoryRow[];
  }

  return (
    <ReviewClient
      initialInvoice={inv}
      initialLines={(lines || []) as SupplierInvoiceLineRow[]}
      initialSuppliers={(suppliers || []) as SupplierRow[]}
      projects={(projects || []) as ProjectRow[]}
      categories={categories}
      fileUrl={signed?.signedUrl || null}
      otherInvoices={(others || []) as SupplierInvoiceRow[]}
      approvalMode={((org as any)?.invoice_approval_mode || "simple") as InvoiceApprovalMode}
      team={(team || []) as TeamMember[]}
      initialEvents={(events || []) as InvoiceEventRow[]}
      initialCanCheck={!!canCheck}
      initialCanApprove={!!canApprove}
      currentUserId={user.id}
    />
  );
}
