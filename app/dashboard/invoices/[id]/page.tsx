import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CategoryRow, ProjectRow, SupplierInvoiceLineRow, SupplierInvoiceRow, SupplierRow } from "@/lib/types";
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
    />
  );
}
