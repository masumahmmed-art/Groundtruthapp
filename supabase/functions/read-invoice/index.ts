import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

// Reads a supplier invoice (PDF or image) with Claude and fills in its header
// fields and lines for a person to review.
//
// Flow: check the caller can see the invoice (RLS, via their own JWT) ->
// check the workspace's monthly allowance -> send the file to Claude ->
// store fields + lines -> record one usage row (service role only).
//
// Secrets: ANTHROPIC_API_KEY. SUPABASE_URL / SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
// Deployed with verify_jwt on.

const MODEL = "claude-haiku-4-5-20251001";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const INVOICE_TOOL = {
  name: "record_invoice",
  description: "Record the fields read from a supplier tax invoice.",
  input_schema: {
    type: "object",
    properties: {
      supplier_name: { type: "string", description: "Seller's business name as printed." },
      supplier_abn: { type: "string", description: "Seller's 11-digit ABN, digits only, or empty if not shown." },
      invoice_number: { type: "string" },
      invoice_date: { type: "string", description: "YYYY-MM-DD, or empty." },
      due_date: { type: "string", description: "YYYY-MM-DD, or empty." },
      subtotal_ex_gst: { type: "number", description: "Total excluding GST." },
      gst: { type: "number", description: "Total GST amount." },
      total: { type: "number", description: "Total including GST." },
      is_tax_invoice: { type: "boolean", description: "True if the document says 'Tax Invoice'." },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string", description: "e.g. hour, day, tonne, m3, each. Empty if none." },
            unit_price_ex_gst: { type: "number" },
            amount_ex_gst: { type: "number" },
            gst: { type: "number" },
            suggested_cost_type: {
              type: "string",
              enum: ["labour", "plant", "material", "subcontract"],
              description: "plant = equipment hire; material = goods supplied; subcontract = work done by another business; labour = labour hire.",
            },
          },
          required: ["description", "amount_ex_gst", "gst", "suggested_cost_type"],
        },
      },
      reading_notes: { type: "string", description: "Anything unclear or that didn't add up. Empty if all fine." },
    },
    required: ["supplier_name", "supplier_abn", "invoice_number", "subtotal_ex_gst", "gst", "total", "lines"],
  },
};

const PROMPT =
  "This is a supplier invoice received by an Australian civil construction contractor. " +
  "Read it and call record_invoice. Amounts are in dollars as plain numbers. " +
  "Give every line's amount EXCLUDING GST and its GST separately; if the invoice only shows GST-inclusive " +
  "amounts, divide by 11 for the GST on taxable lines. GST-free lines have gst 0. " +
  "Include delivery, fuel levies and surcharges as their own lines. Don't invent values: use 0 or empty " +
  "strings when something isn't on the document, and say so in reading_notes.";

function cleanDate(v: unknown): string | null {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}
function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const userDb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceDb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let invoiceId = "";
  try {
    invoiceId = String((await req.json())?.invoice_id ?? "");
  } catch {
    return json({ error: "Body must be JSON: { \"invoice_id\": \"...\" }" }, 400);
  }

  // RLS: returns nothing unless the caller is a member of the invoice's workspace.
  const { data: inv, error: invErr } = await userDb
    .from("supplier_invoices")
    .select("id, org_id, status, file_path, file_name")
    .eq("id", invoiceId)
    .maybeSingle();
  if (invErr || !inv) return json({ error: "Invoice not found." }, 404);
  if (!["uploaded", "reading", "needs_review"].includes(inv.status)) {
    return json({ error: "locked", message: "This invoice has been submitted or approved, so it can't be read again." }, 409);
  }

  const { data: allowanceRows, error: allowErr } = await userDb.rpc("invoice_read_allowance", { p_org_id: inv.org_id });
  const allowance = Array.isArray(allowanceRows) ? allowanceRows[0] : null;
  if (allowErr || !allowance) return json({ error: "Couldn't check your monthly allowance." }, 500);
  if (!allowance.can_read) {
    return json(
      {
        error: "allowance_used",
        message: `You've used all ${allowance.free_allowance} free invoice reads this month. Enter the details yourself, or add billing to keep reading invoices automatically.`,
        used: allowance.used,
        free_allowance: allowance.free_allowance,
      },
      402,
    );
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    await userDb.from("supplier_invoices").update({
      status: "needs_review",
      extraction_error: "Automatic reading isn't switched on yet. Enter the details from the invoice.",
    }).eq("id", inv.id);
    return json({ error: "not_configured", message: "Automatic reading isn't switched on yet." }, 503);
  }

  await userDb.from("supplier_invoices").update({ status: "reading", extraction_error: null }).eq("id", inv.id);

  // Download the file with the caller's permissions.
  const { data: file, error: dlErr } = await userDb.storage.from("invoices").download(inv.file_path);
  if (dlErr || !file) {
    await userDb.from("supplier_invoices").update({ status: "needs_review", extraction_error: "Couldn't open the uploaded file." }).eq("id", inv.id);
    return json({ error: "Couldn't open the uploaded file." }, 500);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = file.type || (inv.file_name?.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
  const data = encodeBase64(bytes);
  const fileBlock = mediaType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data } };

  let result: Record<string, unknown> | null = null;
  let usage = { input_tokens: 0, output_tokens: 0 };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        tools: [INVOICE_TOOL],
        tool_choice: { type: "tool", name: "record_invoice" },
        messages: [{ role: "user", content: [fileBlock, { type: "text", text: PROMPT }] }],
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
    usage = body.usage ?? usage;
    const toolUse = (body.content ?? []).find((c: { type: string }) => c.type === "tool_use");
    result = toolUse?.input ?? null;
    if (!result) throw new Error("No structured result returned.");
  } catch (e) {
    await userDb.from("supplier_invoices").update({
      status: "needs_review",
      extraction_error: `Automatic reading failed (${(e as Error).message}). Enter the details from the invoice.`,
    }).eq("id", inv.id);
    return json({ error: "read_failed", message: (e as Error).message }, 502);
  }

  // Count the read (only the server can write usage rows).
  await serviceDb.from("ai_usage").insert({
    org_id: inv.org_id,
    feature: "invoice_read",
    invoice_id: inv.id,
    billable: allowance.used >= allowance.free_allowance,
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
  });

  const abn = String(result.supplier_abn ?? "").replace(/\D/g, "");
  let supplierId: string | null = null;
  if (abn.length === 11) {
    const { data: sup } = await userDb.from("suppliers").select("id").eq("org_id", inv.org_id).eq("abn", abn).maybeSingle();
    supplierId = sup?.id ?? null;
  }

  const lines = Array.isArray(result.lines) ? (result.lines as Record<string, unknown>[]) : [];
  await userDb.from("supplier_invoice_lines").delete().eq("invoice_id", inv.id);
  if (lines.length) {
    await userDb.from("supplier_invoice_lines").insert(
      lines.map((l, i) => ({
        invoice_id: inv.id,
        description: String(l.description ?? "").slice(0, 500),
        quantity: num(l.quantity),
        unit: String(l.unit ?? "").slice(0, 40),
        unit_price: num(l.unit_price_ex_gst),
        amount_ex_gst: num(l.amount_ex_gst),
        gst: num(l.gst),
        cost_type: ["labour", "plant", "material", "subcontract"].includes(String(l.suggested_cost_type))
          ? String(l.suggested_cost_type)
          : "material",
        sort_order: i + 1,
      })),
    );
  }

  const notes = String(result.reading_notes ?? "").trim();
  await userDb.from("supplier_invoices").update({
    status: "needs_review",
    supplier_id: supplierId,
    supplier_name_on_invoice: String(result.supplier_name ?? "").slice(0, 200),
    abn_on_invoice: abn,
    invoice_number: String(result.invoice_number ?? "").slice(0, 100),
    invoice_date: cleanDate(result.invoice_date),
    due_date: cleanDate(result.due_date),
    subtotal_ex_gst: num(result.subtotal_ex_gst),
    gst: num(result.gst),
    total: num(result.total),
    extracted: result,
    extraction_error: notes ? `Check: ${notes}` : null,
  }).eq("id", inv.id);

  return json({ ok: true, lines: lines.length, supplier_matched: !!supplierId, used: allowance.used + 1, free_allowance: allowance.free_allowance });
});
