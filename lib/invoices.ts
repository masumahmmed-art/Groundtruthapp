import type { SupplierInvoiceLineRow, SupplierInvoiceRow, SupplierInvoiceStatus, SupplierRow } from "@/lib/types";

export const INVOICE_STATUS_LABELS: Record<SupplierInvoiceStatus, string> = {
  uploaded: "Uploaded",
  reading: "Reading…",
  needs_review: "Needs review",
  awaiting_check: "Awaiting project check",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
};

export const INVOICE_STATUS_COLOURS: Record<SupplierInvoiceStatus, string> = {
  uploaded: "var(--ink-soft)",
  reading: "var(--ink-soft)",
  needs_review: "var(--warning)",
  awaiting_check: "var(--accent)",
  awaiting_approval: "var(--accent)",
  approved: "var(--ok, #2f7d4f)",
  rejected: "var(--danger)",
};

/** Statuses in which the invoice and its lines can still be edited. */
export const EDITABLE_INVOICE_STATUSES = ["uploaded", "reading", "needs_review"] as const;

export function isEditableInvoice(status: string): boolean {
  return (EDITABLE_INVOICE_STATUSES as readonly string[]).includes(status);
}

export const INVOICE_EVENT_LABELS: Record<string, string> = {
  submitted: "Submitted for approval",
  checked: "Project check done — goods or work received",
  approved: "Approved and posted to Actuals",
  sent_back: "Sent back for changes",
  rejected: "Rejected",
};

export const MAX_INVOICE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_INVOICE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

/** Rounds to cents so floating-point noise doesn't fail a check. */
export function cents(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Same ATO checksum the database enforces. */
export function isValidAbn(abn: string): boolean {
  const d = (abn || "").replace(/\D/g, "");
  if (!/^\d{11}$/.test(d)) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  let total = 0;
  for (let i = 0; i < 11; i++) {
    let v = Number(d[i]);
    if (i === 0) v -= 1;
    total += v * weights[i];
  }
  return total % 89 === 0;
}

export type CheckLevel = "ok" | "warn" | "error";
export interface InvoiceCheck {
  level: CheckLevel;
  text: string;
}

/**
 * Checks shown beside an invoice before approval. "error" blocks approval;
 * "warn" is shown but the user can still approve (e.g. a GST-free line).
 */
export function invoiceChecks(
  inv: SupplierInvoiceRow,
  lines: SupplierInvoiceLineRow[],
  supplier: SupplierRow | undefined,
  duplicateOf: SupplierInvoiceRow | undefined
): InvoiceCheck[] {
  const checks: InvoiceCheck[] = [];
  const tolerance = 0.05;

  if (!supplier) {
    checks.push({ level: "error", text: "Link the invoice to a supplier from your register." });
  } else {
    if (inv.abn_on_invoice && inv.abn_on_invoice !== supplier.abn) {
      checks.push({ level: "warn", text: "The ABN on the invoice doesn't match the supplier's ABN in your register." });
    }
    if (supplier.gst_registered === false && cents(inv.gst) > 0) {
      checks.push({ level: "warn", text: "The invoice charges GST, but the supplier isn't registered for GST." });
    }
    if (supplier.abn_status && supplier.abn_status !== "Active") {
      checks.push({ level: "warn", text: `The supplier's ABN is ${supplier.abn_status.toLowerCase()}.` });
    }
  }

  if (!inv.abn_on_invoice) {
    checks.push({ level: "warn", text: "No ABN on the invoice. Payments to suppliers who don't quote an ABN may need tax withheld." });
  } else if (!isValidAbn(inv.abn_on_invoice)) {
    checks.push({ level: "warn", text: "The ABN on the invoice fails the ATO checksum." });
  }

  if (!inv.invoice_number.trim()) checks.push({ level: "warn", text: "No invoice number." });
  if (!inv.invoice_date) checks.push({ level: "warn", text: "No invoice date. Costs will be dated today." });

  if (duplicateOf) {
    checks.push({
      level: "error",
      text: `Possible duplicate: invoice ${duplicateOf.invoice_number} from this supplier was already uploaded on ${new Date(duplicateOf.created_at).toLocaleDateString()}.`,
    });
  }

  if (lines.length === 0) {
    checks.push({ level: "error", text: "Add at least one line." });
  } else {
    const sumEx = cents(lines.reduce((t, l) => t + Number(l.amount_ex_gst || 0), 0));
    const sumGst = cents(lines.reduce((t, l) => t + Number(l.gst || 0), 0));
    if (Math.abs(sumEx - cents(inv.subtotal_ex_gst)) > tolerance) {
      checks.push({ level: "error", text: `Lines add up to ${sumEx.toFixed(2)} ex GST, but the invoice subtotal is ${cents(inv.subtotal_ex_gst).toFixed(2)}.` });
    }
    if (Math.abs(sumGst - cents(inv.gst)) > tolerance) {
      checks.push({ level: "error", text: `Line GST adds up to ${sumGst.toFixed(2)}, but the invoice GST is ${cents(inv.gst).toFixed(2)}.` });
    }
    if (lines.some((l) => !l.project_id)) {
      checks.push({ level: "error", text: "Every line needs a project." });
    }
  }

  if (Math.abs(cents(inv.subtotal_ex_gst) + cents(inv.gst) - cents(inv.total)) > tolerance) {
    checks.push({ level: "error", text: "Subtotal plus GST doesn't equal the invoice total." });
  }
  if (cents(inv.subtotal_ex_gst) > 0 && cents(inv.gst) > 0) {
    const rate = cents(inv.gst) / cents(inv.subtotal_ex_gst);
    if (rate > 0.101 || rate < 0.05) {
      checks.push({ level: "warn", text: `GST is ${(rate * 100).toFixed(1)}% of the subtotal, not 10%. Check for GST-free items.` });
    }
  }

  if (checks.length === 0) checks.push({ level: "ok", text: "Everything adds up." });
  return checks;
}

/** Turns an error from the read-invoice function into a sentence for the user. */
export async function readInvoiceErrorMessage(error: unknown): Promise<string> {
  // supabase-js FunctionsHttpError carries the Response on `context`.
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (body?.message) return String(body.message);
      if (body?.error) return String(body.error);
    } catch {
      /* fall through */
    }
  }
  return "Automatic reading didn't work. Enter the details from the invoice.";
}
