import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { REGION_BY_CURRENCY } from "@/lib/units";

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI suggestions are not configured for this workspace yet." }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const unit = String(body.unit || "").trim();
  const kind = String(body.kind || "").trim();
  const currency = String(body.currency || "AUD").trim();

  if (!name) {
    return NextResponse.json({ error: "Missing rate name." }, { status: 400 });
  }

  const region = REGION_BY_CURRENCY[currency] || "Australia";
  const kindLabel =
    kind === "labour" ? "labour rate" : kind === "plant" ? "plant/equipment hire rate" : "material supply rate";

  const prompt = `You are helping a construction estimator in ${region} price a ${kindLabel} for their rate library.

Item: "${name}"
Unit: "${unit || "unspecified - infer a sensible unit"}"
Currency: ${currency}

Search the web for current, realistic pricing for this item in ${region}. Use supplier price lists, hire company rate cards, government or industry cost guides, or recent job-pricing references where possible.

After researching, respond with a short explanation of what you found, then end your reply with a single fenced JSON block in exactly this shape (numbers only, no currency symbols or commas inside the numbers):

\`\`\`json
{"rate": 0, "unit": "string", "confidence": "low|medium|high", "note": "one short sentence explaining the figure"}
\`\`\`

If you cannot find a reliable figure, still give your best estimate and set "confidence" to "low".`;

  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
