"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  CategoryRow,
  CostType,
  InvoiceApprovalMode,
  InvoiceEventRow,
  ProjectRow,
  TeamMember,
  SupplierInvoiceLineRow,
  SupplierInvoiceRow,
  SupplierRow,
} from "@/lib/types";
import { COST_TYPE_LABELS } from "@/lib/calc";
import { useOrgSettings } from "@/lib/OrgSettingsContext";
import { formatMoney } from "@/lib/units";
import {
  INVOICE_EVENT_LABELS,
  INVOICE_STATUS_COLOURS,
  INVOICE_STATUS_LABELS,
  cents,
  invoiceChecks,
  isEditableInvoice,
  isValidAbn,
  readInvoiceErrorMessage,
} from "@/lib/invoices";

type HeaderField =
  | "supplier_name_on_invoice"
  | "abn_on_invoice"
  | "invoice_number"
  | "invoice_date"
  | "due_date"
  | "subtotal_ex_gst"
  | "gst"
  | "total"
  | "notes";

export default function ReviewClient({
  initialInvoice,
  initialLines,
  initialSuppliers,
  projects,
  categories,
  fileUrl,
  otherInvoices,
  approvalMode,
  team,
  initialEvents,
  initialCanCheck,
  initialCanApprove,
  currentUserId,
}: {
  initialInvoice: SupplierInvoiceRow;
  initialLines: SupplierInvoiceLineRow[];
  initialSuppliers: SupplierRow[];
  projects: ProjectRow[];
  categories: CategoryRow[];
  fileUrl: string | null;
  otherInvoices: SupplierInvoiceRow[];
  approvalMode: InvoiceApprovalMode;
  team: TeamMember[];
  initialEvents: InvoiceEventRow[];
  initialCanCheck: boolean;
  initialCanApprove: boolean;
  currentUserId: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const { currency } = useOrgSettings();
  const [inv, setInv] = useState<SupplierInvoiceRow>(initialInvoice);
  const [lines, setLines] = useState<SupplierInvoiceLineRow[]>(initialLines);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>(initialSuppliers);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [events, setEvents] = useState<InvoiceEventRow[]>(initialEvents);
  const [canCheck, setCanCheck] = useState(initialCanCheck);
  const [canApprove, setCanApprove] = useState(initialCanApprove);

  const locked = !isEditableInvoice(inv.status);
  const me = team.find((m) => m.user_id === currentUserId);
  const myLimit = me ? (me.role === "owner" ? Infinity : me.approval_limit) : null;
  const checkAlsoApproves = myLimit !== null && myLimit >= cents(inv.total);
  const emailOf = (id: string | null) => team.find((m) => m.user_id === id)?.email || "someone";
  const lineProjectIds = Array.from(new Set(lines.map((l) => l.project_id).filter(Boolean))) as string[];
  const managers = lineProjectIds
    .map((pid) => projects.find((p) => p.id === pid)?.manager_user_id)
    .filter((x): x is string => !!x);
  const waitingOn =
    inv.status === "awaiting_check"
      ? managers.length
        ? `the project manager${managers.length > 1 ? "s" : ""} (${Array.from(new Set(managers)).map(emailOf).join(", ")})`
        : "anyone in the team other than the person who submitted it"
      : inv.status === "awaiting_approval"
        ? `someone with an approval limit of at least ${formatMoney(inv.total, currency, 2)} (other than the person who submitted it)`
        : "";
  const supplier = suppliers.find((s) => s.id === inv.supplier_id);
  const isPdf = inv.file_path.toLowerCase().endsWith(".pdf");

  const duplicateOf = useMemo(
    () =>
      inv.supplier_id && inv.invoice_number.trim()
        ? otherInvoices.find(
            (o) =>
              o.supplier_id === inv.supplier_id &&
              o.invoice_number.trim().toLowerCase() === inv.invoice_number.trim().toLowerCase()
          )
        : undefined,
    [otherInvoices, inv.supplier_id, inv.invoice_number]
  );
  const checks = useMemo(() => invoiceChecks(inv, lines, supplier, duplicateOf), [inv, lines, supplier, duplicateOf]);
  const blocking = checks.some((c) => c.level === "error");

  // --- Header -------------------------------------------------------------
  function setHeader(patch: Partial<SupplierInvoiceRow>) {
    setInv((prev) => ({ ...prev, ...patch }));
  }
  async function saveHeader(patch: Partial<SupplierInvoiceRow>) {
    if (locked) return;
    const { error } = await supabase.from("supplier_invoices").update(patch).eq("id", inv.id);
    if (error) setMessage(error.message);
  }
  function headerInput(field: HeaderField, label: string, type: "text" | "date" | "number" = "text") {
    const raw = inv[field] as string | number | null;
    return (
      <div className="field" style={{ flex: type === "text" ? "1 1 200px" : "1 1 130px" }}>
        <label>{label}</label>
        <input
          type={type}
          className={type === "number" ? "mono" : undefined}
          step={type === "number" ? "0.01" : undefined}
          disabled={locked}
          value={raw ?? ""}
          onChange={(e) => {
            const v = type === "number" ? parseFloat(e.target.value) || 0 : type === "date" ? e.target.value || null : e.target.value;
            setHeader({ [field]: v } as Partial<SupplierInvoiceRow>);
          }}
          onBlur={(e) => {
            const v = type === "number" ? parseFloat(e.target.value) || 0 : type === "date" ? e.target.value || null : e.target.value;
            saveHeader({ [field]: v } as Partial<SupplierInvoiceRow>);
          }}
        />
      </div>
    );
  }

  async function linkSupplier(id: string) {
    const v = id || null;
    setHeader({ supplier_id: v });
    await saveHeader({ supplier_id: v });
  }

  async function createSupplierFromInvoice() {
    const abn = inv.abn_on_invoice.replace(/\D/g, "");
    if (!isValidAbn(abn)) {
      setMessage("Fix the ABN on the invoice first. It needs 11 digits that pass the ATO checksum.");
      return;
    }
    const existing = suppliers.find((s) => s.abn === abn);
    if (existing) {
      await linkSupplier(existing.id);
      return;
    }
    const type = lines[0]?.cost_type === "plant" ? "plant_hire" : lines[0]?.cost_type === "subcontract" ? "subcontractor" : lines[0]?.cost_type === "material" ? "materials" : "other";
    const { data, error } = await supabase
      .from("suppliers")
      .insert({ org_id: inv.org_id, abn, legal_name: inv.supplier_name_on_invoice.trim(), supplier_type: type })
      .select("*")
      .single();
    if (error || !data) {
      setMessage(error?.message || "Couldn't add the supplier.");
      return;
    }
    setSuppliers((prev) => [...prev, data as SupplierRow]);
    await linkSupplier((data as SupplierRow).id);
    setMessage("Added to your supplier register. Look up the ABN there to confirm GST status.");
  }

  // --- Lines --------------------------------------------------------------
  function updateLine(id: string, patch: Partial<SupplierInvoiceLineRow>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  async function saveLine(id: string, patch: Partial<SupplierInvoiceLineRow>) {
    if (locked) return;
    const { error } = await supabase.from("supplier_invoice_lines").update(patch).eq("id", id);
    if (error) setMessage(error.message);
  }
  function setLine(id: string, patch: Partial<SupplierInvoiceLineRow>) {
    updateLine(id, patch);
    saveLine(id, patch);
  }
  async function addLine() {
    const { data, error } = await supabase
      .from("supplier_invoice_lines")
      .insert({
        invoice_id: inv.id,
        description: "",
        cost_type: "material",
        project_id: lines[lines.length - 1]?.project_id ?? null,
        sort_order: lines.length + 1,
      })
      .select("*")
      .single();
    if (error || !data) {
      setMessage(error?.message || "Couldn't add a line.");
      return;
    }
    setLines((prev) => [...prev, data as SupplierInvoiceLineRow]);
  }
  async function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
    await supabase.from("supplier_invoice_lines").delete().eq("id", id);
  }
  async function applyProjectToAll(projectId: string) {
    if (!projectId) return;
    setLines((prev) => prev.map((l) => ({ ...l, project_id: projectId, category_id: l.project_id === projectId ? l.category_id : null })));
    await supabase
      .from("supplier_invoice_lines")
      .update({ project_id: projectId, category_id: null })
      .eq("invoice_id", inv.id)
      .neq("project_id", projectId);
    await supabase.from("supplier_invoice_lines").update({ project_id: projectId }).eq("invoice_id", inv.id).is("project_id", null);
  }
  /** Line amount ex GST from qty × unit price, with GST at 10% unless the line was GST-free. */
  function recalcLine(l: SupplierInvoiceLineRow, patch: Partial<SupplierInvoiceLineRow>) {
    const next = { ...l, ...patch };
    const amount = cents(next.quantity * next.unit_price);
    const wasGstFree = cents(l.gst) === 0 && cents(l.amount_ex_gst) !== 0;
    const gst = wasGstFree ? 0 : cents(amount * 0.1);
    setLine(l.id, { ...patch, amount_ex_gst: amount, gst });
  }

  // --- Actions ------------------------------------------------------------
  async function reread() {
    if (!confirm("Read the invoice again? This replaces the header fields and lines with a fresh reading.")) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.functions.invoke("read-invoice", { body: { invoice_id: inv.id } });
    if (error) setMessage(await readInvoiceErrorMessage(error));
    setBusy(false);
    router.refresh();
    const [{ data: fresh }, { data: freshLines }] = await Promise.all([
      supabase.from("supplier_invoices").select("*").eq("id", inv.id).single(),
      supabase.from("supplier_invoice_lines").select("*").eq("invoice_id", inv.id).order("sort_order"),
    ]);
    if (fresh) setInv(fresh as SupplierInvoiceRow);
    if (freshLines) setLines(freshLines as SupplierInvoiceLineRow[]);
  }

  async function refreshAll() {
    const [{ data: fresh }, { data: freshLines }, { data: freshEvents }, { data: cc }, { data: ca }] = await Promise.all([
      supabase.from("supplier_invoices").select("*").eq("id", inv.id).single(),
      supabase.from("supplier_invoice_lines").select("*").eq("invoice_id", inv.id).order("sort_order"),
      supabase.from("invoice_events").select("*").eq("invoice_id", inv.id).order("created_at"),
      supabase.rpc("can_check_supplier_invoice", { p_invoice_id: inv.id }),
      supabase.rpc("can_approve_supplier_invoice", { p_invoice_id: inv.id }),
    ]);
    if (fresh) setInv(fresh as SupplierInvoiceRow);
    if (freshLines) setLines(freshLines as SupplierInvoiceLineRow[]);
    if (freshEvents) setEvents(freshEvents as InvoiceEventRow[]);
    setCanCheck(!!cc);
    setCanApprove(!!ca);
    router.refresh();
  }

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, success: string) {
    setBusy(true);
    setMessage("");
    const { error } = await fn();
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(success);
    await refreshAll();
  }

  // Simple mode: one-step approval.
  async function approve() {
    if (blocking) return;
    if (!confirm(`Approve and post ${lines.length} line${lines.length === 1 ? "" : "s"} to project Actuals? Approved invoices can't be edited.`)) return;
    await run(() => supabase.rpc("approve_supplier_invoice", { p_invoice_id: inv.id }), "Approved. The costs are now on each project's Actuals tab.");
  }

  // Two-step mode.
  async function submit() {
    if (blocking) return;
    if (!confirm("Submit this invoice for approval? It can't be edited while it's being approved.")) return;
    await run(() => supabase.rpc("submit_supplier_invoice", { p_invoice_id: inv.id }), "Submitted. It's now waiting for the project check.");
  }

  async function confirmReceived() {
    const note = window.prompt(
      checkAlsoApproves
        ? "Confirm the goods or work were received, and approve. Add a note (optional), e.g. docket numbers checked:"
        : "Confirm the goods or work were received. Add a note (optional), e.g. docket numbers checked:",
      ""
    );
    if (note === null) return;
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("check_supplier_invoice", { p_invoice_id: inv.id, p_note: note });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(
      data === "approved"
        ? "Checked and approved. The costs are now on each project's Actuals tab."
        : "Checked. It now needs approval from someone whose limit covers the total."
    );
    await refreshAll();
  }

  async function finalApprove() {
    const note = window.prompt("Approve and post to Actuals. Add a note (optional):", "");
    if (note === null) return;
    await run(
      () => supabase.rpc("final_approve_supplier_invoice", { p_invoice_id: inv.id, p_note: note }),
      "Approved. The costs are now on each project's Actuals tab."
    );
  }

  async function sendBack() {
    const reason = window.prompt("Why are you sending it back? The person preparing it will see this.", "");
    if (reason === null) return;
    if (!reason.trim()) {
      setMessage("Add a reason so they know what to fix.");
      return;
    }
    await run(() => supabase.rpc("send_back_supplier_invoice", { p_invoice_id: inv.id, p_reason: reason }), "Sent back for changes.");
  }

  async function reject() {
    const reason = window.prompt("Reject this invoice? Nothing is posted to Actuals. Reason (optional):", "");
    if (reason === null) return;
    await run(() => supabase.rpc("reject_supplier_invoice", { p_invoice_id: inv.id, p_reason: reason }), "Rejected.");
  }

  const sumEx = cents(lines.reduce((t, l) => t + Number(l.amount_ex_gst || 0), 0));
  const sumGst = cents(lines.reduce((t, l) => t + Number(l.gst || 0), 0));

  return (
    <div>
      <div className="titleblock">
        <div>
          <div className="hint" style={{ marginBottom: 4 }}>
            <Link href="/dashboard/invoices">← Supplier invoices</Link>
          </div>
          <h2>{supplier ? supplier.trading_name || supplier.legal_name : inv.supplier_name_on_invoice || "Supplier invoice"}</h2>
          <div className="meta">
            {inv.invoice_number ? `Invoice ${inv.invoice_number}` : inv.file_name}
            {" · "}
            <span style={{ color: INVOICE_STATUS_COLOURS[inv.status], fontWeight: 600 }}>{INVOICE_STATUS_LABELS[inv.status]}</span>
          </div>
        </div>
        <div className="stamp">
          Total
          <br />
          <span className="mono" style={{ fontSize: 16, color: "var(--ink)" }}>{formatMoney(inv.total, currency, 2)}</span>
        </div>
      </div>

      {inv.extraction_error && !locked && (
        <div className="note">
          <span>⚠</span>
          <span>{inv.extraction_error}</span>
        </div>
      )}
      {message && (
        <div className="note">
          <span>ℹ</span>
          <span>{message}</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 20, alignItems: "start" }}>
        {/* The invoice itself */}
        <div className="card" style={{ position: "sticky", top: 70, height: "78vh", overflow: "hidden" }}>
          {fileUrl ? (
            isPdf ? (
              <iframe src={fileUrl} title="Invoice" style={{ width: "100%", height: "100%", border: 0 }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl} alt="Invoice" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            )
          ) : (
            <div className="empty">The file couldn&apos;t be loaded.</div>
          )}
        </div>

        {/* Fields, checks, lines */}
        <div>
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div className="section-head" style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: 16 }}>Supplier</h3>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className="field" style={{ flex: "1 1 220px" }}>
                <label>From your register</label>
                <select value={inv.supplier_id || ""} disabled={locked} onChange={(e) => linkSupplier(e.target.value)}>
                  <option value="">Not linked</option>
                  {suppliers
                    .filter((s) => s.is_active || s.id === inv.supplier_id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.trading_name || s.legal_name} — {s.abn}
                      </option>
                    ))}
                </select>
              </div>
              {!inv.supplier_id && !locked && (
                <button type="button" className="btn btn-sm" onClick={createSupplierFromInvoice}>
                  Add as new supplier
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
              {headerInput("supplier_name_on_invoice", "Name on invoice")}
              {headerInput("abn_on_invoice", "ABN on invoice")}
            </div>
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div className="section-head" style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: 16 }}>Invoice</h3>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {headerInput("invoice_number", "Invoice number")}
              {headerInput("invoice_date", "Invoice date", "date")}
              {headerInput("due_date", "Due date", "date")}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
              {headerInput("subtotal_ex_gst", "Subtotal ex GST", "number")}
              {headerInput("gst", "GST", "number")}
              {headerInput("total", "Total", "number")}
            </div>
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div className="section-head" style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: 16 }}>Checks</h3>
            </div>
            {checks.map((c, i) => (
              <div
                key={i}
                style={{
                  fontSize: 13,
                  padding: "4px 0",
                  color: c.level === "error" ? "var(--danger)" : c.level === "warn" ? "var(--warning)" : "var(--ink)",
                }}
              >
                {c.level === "error" ? "✕ " : c.level === "warn" ? "! " : "✓ "}
                {c.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section" style={{ marginTop: 24 }}>
        <div className="section-head">
          <h3>Lines</h3>
          {!locked && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select defaultValue="" onChange={(e) => applyProjectToAll(e.target.value)} style={{ width: 220 }}>
                <option value="">Set project for all lines…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button className="btn btn-sm" onClick={addLine}>+ Add line</button>
            </div>
          )}
        </div>
        <div className="card rate-table-wrap">
          <table className="table-fixed">
            <thead>
              <tr>
                <th style={{ width: 230 }}>Description</th>
                <th className="num" style={{ width: 80 }}>Qty</th>
                <th style={{ width: 70 }}>Unit</th>
                <th className="num" style={{ width: 100 }}>Unit price</th>
                <th className="num" style={{ width: 110 }}>Amount ex GST</th>
                <th className="num" style={{ width: 90 }}>GST</th>
                <th style={{ width: 180 }}>Project</th>
                <th style={{ width: 160 }}>Category</th>
                <th style={{ width: 120 }}>Cost type</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr>
                  <td colSpan={10} className="empty">No lines yet. Add them from the invoice.</td>
                </tr>
              )}
              {lines.map((l) => {
                const projectCategories = categories.filter((c) => c.project_id === l.project_id);
                return (
                  <tr key={l.id}>
                    <td>
                      <input
                        type="text"
                        disabled={locked}
                        value={l.description}
                        onChange={(e) => updateLine(l.id, { description: e.target.value })}
                        onBlur={(e) => saveLine(l.id, { description: e.target.value })}
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        className="mono"
                        step="any"
                        disabled={locked}
                        value={l.quantity}
                        onChange={(e) => updateLine(l.id, { quantity: parseFloat(e.target.value) || 0 })}
                        onBlur={(e) => recalcLine(l, { quantity: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        disabled={locked}
                        value={l.unit}
                        onChange={(e) => updateLine(l.id, { unit: e.target.value })}
                        onBlur={(e) => saveLine(l.id, { unit: e.target.value })}
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        className="mono"
                        step="0.01"
                        disabled={locked}
                        value={l.unit_price}
                        onChange={(e) => updateLine(l.id, { unit_price: parseFloat(e.target.value) || 0 })}
                        onBlur={(e) => recalcLine(l, { unit_price: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        className="mono"
                        step="0.01"
                        disabled={locked}
                        value={l.amount_ex_gst}
                        onChange={(e) => updateLine(l.id, { amount_ex_gst: parseFloat(e.target.value) || 0 })}
                        onBlur={(e) => saveLine(l.id, { amount_ex_gst: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        className="mono"
                        step="0.01"
                        disabled={locked}
                        value={l.gst}
                        onChange={(e) => updateLine(l.id, { gst: parseFloat(e.target.value) || 0 })}
                        onBlur={(e) => saveLine(l.id, { gst: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <select
                        disabled={locked}
                        value={l.project_id || ""}
                        onChange={(e) => setLine(l.id, { project_id: e.target.value || null, category_id: null })}
                      >
                        <option value="">Select…</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        disabled={locked || !l.project_id}
                        value={l.category_id || ""}
                        onChange={(e) => setLine(l.id, { category_id: e.target.value || null })}
                      >
                        <option value="">{l.project_id ? "Uncategorised" : "Pick a project"}</option>
                        {projectCategories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        disabled={locked}
                        value={l.cost_type}
                        onChange={(e) => setLine(l.id, { cost_type: e.target.value as CostType })}
                      >
                        {Object.entries(COST_TYPE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {!locked && (
                        <button className="btn btn-ghost btn-sm btn-danger" title="Remove line" onClick={() => removeLine(l.id)}>
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {lines.length > 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "right", fontWeight: 600 }}>Lines total</td>
                  <td className="num mono" style={{ fontWeight: 600 }}>{sumEx.toFixed(2)}</td>
                  <td className="num mono" style={{ fontWeight: 600 }}>{sumGst.toFixed(2)}</td>
                  <td colSpan={4}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(inv.status === "awaiting_check" || inv.status === "awaiting_approval") && (
        <div className="note">
          <span>⏳</span>
          <span>
            <b>{inv.status === "awaiting_check" ? "Waiting for the project check" : "Waiting for approval"}</b> by {waitingOn}.
            {inv.submitted_by && <> Submitted by {emailOf(inv.submitted_by)}.</>}
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginBottom: 24 }}>
        {isEditableInvoice(inv.status) && (
          <>
            <button className="btn" disabled={busy} onClick={reread}>
              Read again
            </button>
            <button className="btn btn-ghost btn-danger" disabled={busy} onClick={reject}>
              Reject
            </button>
            {approvalMode === "simple" ? (
              <button
                className="btn btn-primary"
                disabled={busy || blocking}
                title={blocking ? "Fix the items marked ✕ under Checks first" : undefined}
                onClick={approve}
              >
                {busy ? "Working…" : "Approve and post to Actuals"}
              </button>
            ) : (
              <button
                className="btn btn-primary"
                disabled={busy || blocking}
                title={blocking ? "Fix the items marked ✕ under Checks first" : undefined}
                onClick={submit}
              >
                {busy ? "Working…" : "Submit for approval"}
              </button>
            )}
          </>
        )}
        {inv.status === "awaiting_check" && canCheck && (
          <>
            <button className="btn btn-ghost btn-danger" disabled={busy} onClick={reject}>Reject</button>
            <button className="btn" disabled={busy} onClick={sendBack}>Send back</button>
            <button className="btn btn-primary" disabled={busy} onClick={confirmReceived}>
              {checkAlsoApproves ? "Confirm received and approve" : "Confirm received"}
            </button>
          </>
        )}
        {inv.status === "awaiting_approval" && canApprove && (
          <>
            <button className="btn btn-ghost btn-danger" disabled={busy} onClick={reject}>Reject</button>
            <button className="btn" disabled={busy} onClick={sendBack}>Send back</button>
            <button className="btn btn-primary" disabled={busy} onClick={finalApprove}>Approve and post to Actuals</button>
          </>
        )}
      </div>

      {inv.status === "approved" && inv.approved_at && (
        <div className="hint" style={{ textAlign: "right", marginBottom: 16 }}>
          Approved {new Date(inv.approved_at).toLocaleString()}. Posted lines appear on each project&apos;s Actuals tab.
        </div>
      )}

      {events.length > 0 && (
        <div className="section" style={{ marginBottom: 40 }}>
          <div className="section-head">
            <h3>History</h3>
          </div>
          <div className="card" style={{ padding: "12px 18px" }}>
            {events.map((ev) => (
              <div key={ev.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                <b>{INVOICE_EVENT_LABELS[ev.action] || ev.action}</b>
                <span className="hint">
                  {" "}
                  — {ev.actor_email || "someone"}, {new Date(ev.created_at).toLocaleString()}
                </span>
                {ev.note && <div style={{ marginTop: 2 }}>“{ev.note}”</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
