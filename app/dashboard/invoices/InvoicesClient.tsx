"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { InvoiceReadAllowance, SupplierInvoiceRow, SupplierRow } from "@/lib/types";
import { useOrgSettings } from "@/lib/OrgSettingsContext";
import { formatMoney } from "@/lib/units";
import {
  ACCEPTED_INVOICE_TYPES,
  INVOICE_STATUS_COLOURS,
  INVOICE_STATUS_LABELS,
  MAX_INVOICE_BYTES,
  readInvoiceErrorMessage,
} from "@/lib/invoices";

function extensionFor(file: File): string {
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  return "jpg";
}

export default function InvoicesClient({
  orgId,
  initialInvoices,
  suppliers,
  initialAllowance,
}: {
  orgId: string;
  initialInvoices: SupplierInvoiceRow[];
  suppliers: SupplierRow[];
  initialAllowance: InvoiceReadAllowance | null;
}) {
  const supabase = createClient();
  const { currency } = useOrgSettings();
  const [invoices, setInvoices] = useState<SupplierInvoiceRow[]>(initialInvoices);
  const [allowance, setAllowance] = useState<InvoiceReadAllowance | null>(initialAllowance);
  const [messages, setMessages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const fileInput = useRef<HTMLInputElement>(null);

  const supplierName = (id: string | null) => {
    const s = suppliers.find((x) => x.id === id);
    return s ? s.trading_name || s.legal_name : null;
  };

  async function refreshAllowance() {
    const { data } = await supabase.rpc("invoice_read_allowance", { p_org_id: orgId });
    if (Array.isArray(data) && data[0]) setAllowance(data[0] as InvoiceReadAllowance);
  }

  async function refreshInvoice(id: string) {
    const { data } = await supabase.from("supplier_invoices").select("*").eq("id", id).single();
    if (data) setInvoices((prev) => prev.map((i) => (i.id === id ? (data as SupplierInvoiceRow) : i)));
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setBusy(true);
    const notes: string[] = [];

    for (const file of list) {
      if (!ACCEPTED_INVOICE_TYPES.includes(file.type)) {
        notes.push(`${file.name}: only PDF, JPG or PNG files can be uploaded.`);
        continue;
      }
      if (file.size > MAX_INVOICE_BYTES) {
        notes.push(`${file.name}: larger than 10 MB. Try a smaller scan.`);
        continue;
      }

      const id = crypto.randomUUID();
      const path = `${orgId}/${id}.${extensionFor(file)}`;
      const { error: upErr } = await supabase.storage.from("invoices").upload(path, file, { contentType: file.type });
      if (upErr) {
        notes.push(`${file.name}: upload failed (${upErr.message}).`);
        continue;
      }
      const { data: row, error: insErr } = await supabase
        .from("supplier_invoices")
        .insert({ id, org_id: orgId, file_path: path, file_name: file.name, file_size: file.size, status: "uploaded" })
        .select("*")
        .single();
      if (insErr || !row) {
        await supabase.storage.from("invoices").remove([path]);
        notes.push(`${file.name}: couldn't save (${insErr?.message || "unknown error"}).`);
        continue;
      }
      setInvoices((prev) => [{ ...(row as SupplierInvoiceRow), status: "reading" }, ...prev]);

      const { error: readErr } = await supabase.functions.invoke("read-invoice", { body: { invoice_id: id } });
      if (readErr) notes.push(`${file.name}: ${await readInvoiceErrorMessage(readErr)}`);
      await refreshInvoice(id);
    }

    await refreshAllowance();
    setMessages(notes);
    setBusy(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function remove(inv: SupplierInvoiceRow) {
    if (inv.status === "approved") return;
    if (!confirm(`Delete ${inv.file_name || "this invoice"}? The uploaded file is deleted too.`)) return;
    setInvoices((prev) => prev.filter((i) => i.id !== inv.id));
    await supabase.from("supplier_invoices").delete().eq("id", inv.id);
    await supabase.storage.from("invoices").remove([inv.file_path]);
  }

  const visible = invoices.filter((i) => filter === "all" || ["uploaded", "reading", "needs_review"].includes(i.status));
  const toReview = invoices.filter((i) => i.status === "needs_review").length;

  return (
    <div>
      <div className="titleblock">
        <div>
          <h2>Supplier invoices</h2>
          <div className="meta">
            Upload plant hire, material and subcontractor invoices. They&apos;re read automatically, you check and code
            each line to a project, and approving posts the costs to that project&apos;s Actuals.
          </div>
        </div>
        <div className="stamp">
          {allowance ? (
            <>
              Automatic reads this month
              <br />
              <span className="mono" style={{ fontSize: 16, color: "var(--ink)" }}>
                {allowance.used} / {allowance.free_allowance} free
              </span>
            </>
          ) : null}
        </div>
      </div>

      {allowance && !allowance.can_read && (
        <div className="note">
          <span>⚠</span>
          <span>
            <b>Free reads used for this month.</b> New uploads won&apos;t be read automatically — you can still enter
            the details yourself. Paid reading past the free allowance is coming soon.
          </span>
        </div>
      )}

      <div
        className="card"
        style={{
          padding: 24,
          marginBottom: 20,
          textAlign: "center",
          borderStyle: "dashed",
          borderColor: dragging ? "var(--accent)" : undefined,
          background: dragging ? "var(--accent-soft)" : undefined,
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) uploadFiles(e.dataTransfer.files);
        }}
      >
        <div style={{ marginBottom: 10 }}>Drop invoice PDFs or photos here</div>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          multiple
          style={{ display: "none" }}
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
        <button className="btn btn-primary" type="button" disabled={busy} onClick={() => fileInput.current?.click()}>
          {busy ? "Uploading and reading…" : "Choose files"}
        </button>
        <div className="hint" style={{ marginTop: 8 }}>PDF, JPG or PNG, up to 10 MB each.</div>
      </div>

      {messages.length > 0 && (
        <div className="note" style={{ flexDirection: "column", gap: 4 }}>
          {messages.map((m, i) => (
            <div key={i}>{m}</div>
          ))}
        </div>
      )}

      <div className="section">
        <div className="section-head">
          <h3>
            {filter === "open" ? "To review" : "All invoices"}
            {toReview > 0 && filter === "open" ? ` (${toReview})` : ""}
          </h3>
          <select value={filter} onChange={(e) => setFilter(e.target.value as "open" | "all")} style={{ width: 160 }}>
            <option value="open">To review</option>
            <option value="all">All invoices</option>
          </select>
        </div>
        <div className="card rate-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th style={{ width: 130 }}>Invoice #</th>
                <th style={{ width: 110 }}>Date</th>
                <th className="num" style={{ width: 120 }}>Total</th>
                <th style={{ width: 120 }}>Status</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    {filter === "open" ? "Nothing waiting for review." : "No invoices uploaded yet."}
                  </td>
                </tr>
              )}
              {visible.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <b>{supplierName(inv.supplier_id) || inv.supplier_name_on_invoice || "Unknown supplier"}</b>
                    {!inv.supplier_id && inv.status !== "reading" && (
                      <div className="hint" style={{ color: "var(--warning)" }}>Not linked to a supplier</div>
                    )}
                    <div className="hint">{inv.file_name}</div>
                  </td>
                  <td className="mono">{inv.invoice_number || "—"}</td>
                  <td>{inv.invoice_date ? new Date(inv.invoice_date + "T00:00:00").toLocaleDateString() : "—"}</td>
                  <td className="num mono">{inv.total ? formatMoney(inv.total, currency, 2) : "—"}</td>
                  <td style={{ color: INVOICE_STATUS_COLOURS[inv.status], fontWeight: 600 }}>{INVOICE_STATUS_LABELS[inv.status]}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Link className="btn btn-sm" href={`/dashboard/invoices/${inv.id}`}>
                      {inv.status === "approved" || inv.status === "rejected" ? "View" : "Review"}
                    </Link>
                    {inv.status !== "approved" && (
                      <button className="btn btn-ghost btn-sm btn-danger" title="Delete" onClick={() => remove(inv)}>
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
