import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Looks up an ABN on the Australian Business Register (ABN Lookup web services).
// Requires the ABR_GUID secret (free, register at abr.business.gov.au/Tools/WebServices).
// Called from the app with the user's session; verify_jwt is on.
// Deployed to production on 2 Oct 2026 — keep this file in sync with what's deployed.

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

function isValidAbn(abn: string): boolean {
  if (!/^\d{11}$/.test(abn)) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  let total = 0;
  for (let i = 0; i < 11; i++) {
    let d = Number(abn[i]);
    if (i === 0) d -= 1;
    total += d * weights[i];
  }
  return total % 89 === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let abn = "";
  try {
    const body = await req.json();
    abn = String(body?.abn ?? "").replace(/\s+/g, "");
  } catch {
    return json({ error: "Body must be JSON: { \"abn\": \"...\" }" }, 400);
  }

  if (!isValidAbn(abn)) {
    return json({ valid: false, error: "That isn't a valid ABN (it fails the ATO checksum)." }, 200);
  }

  const guid = Deno.env.get("ABR_GUID");
  if (!guid) {
    return json({ valid: true, abn, lookedUp: false, error: "ABN Lookup isn't configured yet (missing ABR_GUID secret)." }, 200);
  }

  const url = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${abn}&guid=${encodeURIComponent(guid)}&callback=cb`;
  let data: Record<string, unknown>;
  try {
    const res = await fetch(url);
    const text = await res.text();
    // Response is JSONP: cb({...})
    const start = text.indexOf("(");
    const end = text.lastIndexOf(")");
    data = JSON.parse(text.slice(start + 1, end));
  } catch (e) {
    return json({ valid: true, abn, lookedUp: false, error: `ABN Lookup request failed: ${(e as Error).message}` }, 502);
  }

  if (data.Message) {
    return json({ valid: true, abn, lookedUp: false, error: String(data.Message) }, 200);
  }

  const businessNames = Array.isArray(data.BusinessName) ? (data.BusinessName as string[]) : [];
  return json({
    valid: true,
    lookedUp: true,
    abn,
    status: data.AbnStatus ?? null, // "Active" or "Cancelled"
    entityName: data.EntityName ?? "",
    entityType: data.EntityTypeName ?? "",
    businessNames,
    gstRegistered: Boolean(data.Gst), // Gst holds the registration date when registered
    gstFrom: data.Gst || null,
    state: data.AddressState ?? "",
    postcode: data.AddressPostcode ?? "",
    checkedAt: new Date().toISOString(),
  });
});
