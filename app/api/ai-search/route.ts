import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    return NextResponse.json({ error: "AI search is not configured for this workspace yet." }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const query = String(body.query || "").trim();
  if (!query) {
    return NextResponse.json({ error: "Type a question first." }, { status: 400 });
  }

  const prompt = `Search the web to answer this construction/estimating pricing or reference question. Answer concisely in 2-4 plain-text sentences, citing figures where you found them. Do not use markdown formatting.

Question: "${query}"`;

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
        max_tokens: 700,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text().catch(() => "");
      return NextResponse.json(
        { error: `AI request failed (${aiRes.status}).`, detail: text.slice(0, 500) },
        { status: 502 }
      );
    }

    const data = await aiRes.json();
    const blocks: any[] = data.content || [];

    let answer = "";
    const sources: { title: string; url: string }[] = [];
    for (const block of blocks) {
      if (block.type === "text") answer += block.text;
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const item of block.content) {
          if (item?.url) sources.push({ title: item.title || item.url, url: item.url });
        }
      }
    }

    const uniqueSources = sources.filter((s, i) => sources.findIndex((x) => x.url === s.url) === i).slice(0, 5);

    return NextResponse.json({ answer: answer.trim(), sources: uniqueSources });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error contacting the AI." }, { status: 500 });
  }
}
