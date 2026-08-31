import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

/**
 * Market / price escalation risk lookup.
 *
 * United States -> BLS Producer Price Index (PPI), free keyless public API.
 *                  https://www.bls.gov/developers/api_signature_v2.htm
 *                  Index-number series — this route pulls the raw index
 *                  values itself and computes the 12-month % change by hand.
 *
 * Australia     -> ABS's downloadable Producer Price Indexes workbook
 *                  (table 6427017, "Output of the Construction industries"),
 *                  not their live Data API — that API silently returns an
 *                  empty result to requests from Vercel's servers no matter
 *                  what headers or region are used (confirmed after several
 *                  rounds of diagnosis), so this route instead finds and
 *                  downloads the current quarterly Excel workbook from ABS's
 *                  stable "latest-release" page and reads real numbers out
 *                  of it directly. See the long comment above lookupAU for
 *                  the full story and the workbook's exact layout.
 *
 * United Kingdom -> ONS (Office for National Statistics) v1 API, free and
 *                  keyless. https://api.beta.ons.gov.uk — individual
 *                  domestic Producer Price Index series for construction
 *                  materials (steel/metal inputs, concrete, brick & clay
 *                  products). ONS doesn't publish one blended "all
 *                  construction inputs" aggregate through this API the way
 *                  BLS and ABS do, so this is a materials basket rather
 *                  than a single headline figure — this route computes the
 *                  12-month % change itself from the raw index values.
 *
 * EU member states -> Eurostat's free, keyless dissemination API.
 *                  https://ec.europa.eu/eurostat — "Construction producer
 *                  prices or costs, new residential buildings" (sts_copi_q),
 *                  queried per-country or as an EU-wide figure. Eurostat
 *                  pre-computes the 12-month % change, so this route just
 *                  reads that figure straight off, the same as the AU path.
 *
 * All of these are national, materials/input-cost indicators — a proxy for how fast
 * building costs are moving, not a quote and not specific to this project's
 * exact material mix or region. Useful as an early warning that tender
 * prices may need a bigger (or smaller) escalation allowance than usual,
 * never a substitute for getting current supplier and subcontractor quotes.
 *
 * GET /api/market-risk?location=Ipswich%2C%20QLD
 */

// Some government API gateways (ABS's in particular — confirmed in their own
// troubleshooting docs) return HTTP 403 for requests that don't carry a
// browser-like User-Agent, since Node's built-in fetch() otherwise identifies
// itself as "undici" and gets flagged as a bot. A realistic UA plus a normal
// Accept-Encoding header avoids that.
const EXTERNAL_API_HEADERS: Record<string, string> = {
  accept: "application/json",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  // Deliberately not requesting Brotli ("br") here — Node's fetch (undici) on
  // some serverless runtimes doesn't reliably auto-decompress it, which could
  // turn a working response into an undecodable one. gzip/deflate are safe.
  "accept-encoding": "gzip, deflate",
};

interface GeocodeResult {
  name: string;
  country?: string;
  country_code?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

type SuggestedRisk = { category: "market"; description: string; probability: number } | null;

function locationOut(place: GeocodeResult) {
  return {
    name: place.name,
    state: place.admin1 || null,
    country: place.country || null,
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const location = searchParams.get("location")?.trim();

  if (!location) {
    return NextResponse.json({ error: "Missing ?location=" }, { status: 400 });
  }

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`,
      { cache: "no-store" }
    );
    if (!geoRes.ok) {
      return NextResponse.json(
        { error: "Location lookup failed. Try a more specific location (suburb + state, or city + country)." },
        { status: 502 }
      );
    }
    const geoJson = await geoRes.json();
    const place: GeocodeResult | undefined = geoJson?.results?.[0];
    if (!place) {
      return NextResponse.json({ error: `Couldn't find "${location}". Try a nearby town, or "City, Country".` }, { status: 404 });
    }

    const countryCode = (place.country_code || "").toUpperCase();
    const countryName = (place.country || "").toLowerCase();
    const isUS = countryCode === "US" || countryName === "united states" || countryName === "united states of america";
    const isAU = countryCode === "AU" || countryName === "australia";
    const isUK = countryCode === "GB" || countryName === "united kingdom";
    const euGeo = EU27_EUROSTAT_GEO[countryCode];

    if (isUS) return await lookupUS(place);
    if (isAU) return await lookupAU(place);
    if (isUK) return await lookupUK(place);
    if (euGeo) return await lookupEU(place, euGeo, place.country || "this country");

    return NextResponse.json({
      location: locationOut(place),
      source: null,
      summary: [
        `Automated construction cost/materials trend data isn't wired up yet for ${place.country || "this country"} — it currently covers the United States (BLS), Australia (ABS), the United Kingdom (ONS), and EU member states (Eurostat). Check your local statistics agency's producer/input price index for construction for this market, or add a market risk row manually below.`,
      ],
      categories: [],
      suggestedRisk: null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unexpected error looking up market / price escalation risk." }, { status: 500 });
  }
}

// ---------- shared helpers ----------

function riskFromYoyPct(pct: number, label: string, sourceLabel: string): SuggestedRisk {
  const pctStr = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
  if (pct >= 8) {
    return {
      category: "market",
      description: `${label} up ${pctStr} over the past 12 months (${sourceLabel}) — significant material/cost escalation, allow a larger contingency between tender and procurement`,
      probability: 35,
    };
  }
  if (pct >= 5) {
    return {
      category: "market",
      description: `${label} up ${pctStr} over the past 12 months (${sourceLabel}) — elevated cost escalation, worth an above-normal price escalation allowance`,
      probability: 25,
    };
  }
  if (pct >= 2) {
    return {
      category: "market",
      description: `${label} up ${pctStr} over the past 12 months (${sourceLabel}) — moderate cost escalation, a normal price escalation allowance should cover it`,
      probability: 15,
    };
  }
  return null;
}

interface MarketCategory {
  label: string;
  pct: number;
  latestLabel: string;
  suggestedRisk: SuggestedRisk;
}

// Turns a list of {label, latestLabel, pct} results into per-category rows,
// each with its OWN suggested risk (not just the headline's) — so the UI can
// offer a separate "+ Add" for every category instead of only ever offering
// the first one. The first entry stays the "headline" for display purposes.
function buildMarketCategories(
  results: { label: string; latestLabel: string; pct: number }[],
  sourceLabel: string
): MarketCategory[] {
  return results.map((r) => ({
    label: r.label,
    pct: r.pct,
    latestLabel: r.latestLabel,
    suggestedRisk: riskFromYoyPct(r.pct, r.label, sourceLabel),
  }));
}

// ---------- United States: BLS Producer Price Index ----------

const US_SERIES: { id: string; label: string }[] = [
  { id: "WPUSI012011", label: "Inputs to construction industries (materials & components)" },
  { id: "WPU081", label: "Lumber and wood products" },
  { id: "WPU101", label: "Iron and steel" },
  { id: "WPU133", label: "Concrete ingredients" },
];

interface BlsPoint {
  year: string;
  period: string; // "M01".."M12" monthly, "M13" = annual average (excluded)
  periodName: string;
  value: number;
}

function parseBlsSeries(json: any): BlsPoint[] {
  const raw: any[] = json?.Results?.series?.[0]?.data || [];
  return raw
    .filter((d) => d && typeof d.period === "string" && d.period !== "M13" && !isNaN(parseFloat(d.value)))
    .map((d) => ({ year: String(d.year), period: String(d.period), periodName: String(d.periodName || d.period), value: parseFloat(d.value) }));
}

function yoyFromPoints(points: BlsPoint[]): { latestLabel: string; pct: number } | null {
  if (!points.length) return null;
  // Sort descending by year+period (e.g. "2026M07") so the newest point is first.
  const sorted = [...points].sort((a, b) => `${b.year}${b.period}`.localeCompare(`${a.year}${a.period}`));
  const latest = sorted[0];
  const yearAgo = sorted.find((p) => p.period === latest.period && Number(p.year) === Number(latest.year) - 1);
  if (!yearAgo || yearAgo.value === 0) return null;
  const pct = ((latest.value - yearAgo.value) / yearAgo.value) * 100;
  return { latestLabel: `${latest.periodName} ${latest.year}`, pct };
}

async function lookupUS(place: GeocodeResult) {
  const thisYear = new Date().getFullYear();
  const results: { label: string; latestLabel: string; pct: number }[] = [];
  let anyRequestFailed = false;

  for (const series of US_SERIES) {
    try {
      const url = `https://api.bls.gov/publicAPI/v2/timeseries/data/${series.id}?startyear=${thisYear - 1}&endyear=${thisYear}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: EXTERNAL_API_HEADERS,
      });
      if (!res.ok) {
        anyRequestFailed = true;
        continue;
      }
      const json = await res.json().catch(() => null);
      if (!json || json.status !== "REQUEST_SUCCEEDED") {
        anyRequestFailed = true;
        continue;
      }
      const points = parseBlsSeries(json);
      const yoy = yoyFromPoints(points);
      if (yoy) results.push({ label: series.label, latestLabel: yoy.latestLabel, pct: yoy.pct });
    } catch {
      anyRequestFailed = true;
    }
  }

  if (!results.length) {
    return NextResponse.json({
      location: locationOut(place),
      source: "US Bureau of Labor Statistics — Producer Price Index",
      summary: [
        anyRequestFailed
          ? "Automated lookup didn't complete — the BLS public API may be temporarily unavailable, or its free unregistered tier's daily request limit (shared across everyone using this app) may have been reached for today. Try again later, or check bls.gov/ppi directly."
          : "No usable BLS data was returned for this lookup. Check bls.gov/ppi directly, or add a market risk row manually.",
      ],
      categories: [],
      suggestedRisk: null,
    });
  }

  // Put the primary "inputs to construction" series first if it came through, so it's the headline.
  const headlineIdx = results.findIndex((r) => r.label === US_SERIES[0].label);
  if (headlineIdx > 0) results.unshift(results.splice(headlineIdx, 1)[0]);

  const categories = buildMarketCategories(results, "US BLS PPI");
  const summary: string[] = [
    "This is a national materials/input cost trend, not a quote for this project's actual material mix, region, or supplier — always confirm with current supplier and subcontractor pricing before finalising an escalation allowance.",
  ];

  return NextResponse.json({
    location: locationOut(place),
    source: "US Bureau of Labor Statistics — Producer Price Index",
    summary,
    categories,
    suggestedRisk: categories[0]?.suggestedRisk ?? null,
  });
}

// ---------- Australia: ABS Producer Price Indexes — Output of the Construction industries ----------
//
// ABS's live Data API (data.api.abs.gov.au) turned out to be unusable from
// Vercel's servers: after several rounds of fixes (browser-style headers,
// a Sydney function region), it kept silently returning a validly-shaped
// but empty response — the same query works everywhere except from the
// deployed app, which points to ABS's gateway soft-blocking automated
// cloud traffic rather than anything wrong in this code. The static Excel
// workbook ABS publishes alongside each quarterly release doesn't have
// that problem, so this route reads real numbers out of that file instead.
//
// The download URL embeds the release date (e.g. ".../jun-2026/6427017.xlsx")
// and changes every quarter, so this route first fetches ABS's stable
// "latest-release" landing page and finds the current file's URL in its
// HTML, then downloads and parses that file. It's an ABS "Time Series
// Workbook": sheet "Data1" has each column's Series ID on row 10, and one
// quarter per row from row 11 down, with column A holding the date — this
// exact layout was confirmed against a real downloaded copy of table
// 6427017 ("Output of the Construction industries, subdivision and class
// index numbers"), not guessed.

const ABS_LANDING_PAGE =
  "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/producer-price-indexes-australia/latest-release";
const ABS_TABLE_FILE_ID = "6427017"; // "Output of the Construction industries, subdivision and class index numbers"

const AU_SERIES: { seriesId: string; label: string }[] = [
  { seriesId: "A85219099L", label: "Heavy and civil engineering construction" },
  { seriesId: "A2333664R", label: "Road and bridge construction" },
  { seriesId: "A2333649T", label: "Building construction (all types)" },
  { seriesId: "A2333658V", label: "Non-residential building construction" },
];

async function findCurrentAbsWorkbookUrl(): Promise<{ url: string | null; diag: string }> {
  try {
    const res = await fetch(ABS_LANDING_PAGE, { cache: "no-store", headers: EXTERNAL_API_HEADERS });
    if (!res.ok) return { url: null, diag: `ABS's release page returned HTTP ${res.status}.` };
    const html = await res.text();
    const match = html.match(new RegExp(`href="([^"]*${ABS_TABLE_FILE_ID}\\.xlsx)"`, "i"));
    if (!match) return { url: null, diag: "Couldn't find the current workbook link on ABS's release page (its page layout may have changed)." };
    let url = match[1];
    if (url.startsWith("//")) url = "https:" + url;
    else if (url.startsWith("/")) url = "https://www.abs.gov.au" + url;
    return { url, diag: "" };
  } catch (e: any) {
    return { url: null, diag: `Request to ABS's release page failed: ${e?.message || "unknown error"}.` };
  }
}

function parseAbsWorkbookRows(buffer: ArrayBuffer): { rows: any[][]; diag: string } {
  try {
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheet = workbook.Sheets["Data1"];
    if (!sheet) return { rows: [], diag: "The downloaded workbook didn't contain a 'Data1' sheet (its layout may have changed)." };
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    return { rows, diag: rows.length ? "" : "The 'Data1' sheet appeared to be empty." };
  } catch (e: any) {
    return { rows: [], diag: `Failed to parse the downloaded ABS workbook: ${e?.message || "unknown error"}.` };
  }
}

const ABS_QUARTER_LABELS = ["Mar", "Jun", "Sep", "Dec"];

function yoyFromAbsRows(rows: any[][], seriesId: string): { latestLabel: string; pct: number } | null {
  // Row 10 (1-indexed in Excel) = array index 9 — holds each data column's Series ID.
  const seriesIdRow = rows[9] || [];
  const col = seriesIdRow.findIndex((v) => v === seriesId);
  if (col < 1) return null;
  // Data runs from Excel row 11 (index 10) down, one quarter per row, column A = date.
  for (let r = rows.length - 1; r >= 10; r--) {
    const value = rows[r]?.[col];
    const date = rows[r]?.[0];
    if (typeof value !== "number" || !date) continue;
    const yearAgoValue = rows[r - 4]?.[col]; // same quarter, 4 rows back = 4 quarters earlier
    if (typeof yearAgoValue !== "number" || yearAgoValue === 0) return null;
    const latestLabel =
      date instanceof Date ? `${ABS_QUARTER_LABELS[Math.floor(date.getMonth() / 3)]} ${date.getFullYear()}` : String(date);
    return { latestLabel, pct: ((value - yearAgoValue) / yearAgoValue) * 100 };
  }
  return null;
}

async function lookupAU(place: GeocodeResult) {
  const { url: workbookUrl, diag: findDiag } = await findCurrentAbsWorkbookUrl();
  if (!workbookUrl) {
    return NextResponse.json({
      location: locationOut(place),
      source: "Australian Bureau of Statistics — Producer Price Indexes",
      summary: [`Automated lookup didn't complete — ${findDiag} Check abs.gov.au (Producer Price Indexes, Australia) directly, or add a market risk row manually.`],
      categories: [],
      suggestedRisk: null,
    });
  }

  let rows: any[][] = [];
  let diag = "";
  try {
    const fileRes = await fetch(workbookUrl, { cache: "no-store", headers: EXTERNAL_API_HEADERS });
    if (!fileRes.ok) {
      diag = `ABS workbook download returned HTTP ${fileRes.status}.`;
    } else {
      const buffer = await fileRes.arrayBuffer();
      const parsed = parseAbsWorkbookRows(buffer);
      rows = parsed.rows;
      diag = parsed.diag;
    }
  } catch (e: any) {
    diag = `Request to download the ABS workbook failed: ${e?.message || "unknown error"}.`;
  }

  if (!rows.length) {
    return NextResponse.json({
      location: locationOut(place),
      source: "Australian Bureau of Statistics — Producer Price Indexes",
      summary: [
        `Automated lookup didn't complete — ${diag || "couldn't read the ABS workbook."} Check abs.gov.au (Producer Price Indexes, Australia) directly, or add a market risk row manually.`,
      ],
      categories: [],
      suggestedRisk: null,
    });
  }

  const results: { label: string; latestLabel: string; pct: number }[] = [];
  for (const series of AU_SERIES) {
    const yoy = yoyFromAbsRows(rows, series.seriesId);
    if (yoy) results.push({ label: series.label, latestLabel: yoy.latestLabel, pct: yoy.pct });
  }

  if (!results.length) {
    return NextResponse.json({
      location: locationOut(place),
      source: "Australian Bureau of Statistics — Producer Price Indexes",
      summary: [
        "The ABS workbook downloaded but didn't contain a usable observation for any tracked series — its layout or series IDs may have changed. Check abs.gov.au (Producer Price Indexes, Australia) directly, or add a market risk row manually.",
      ],
      categories: [],
      suggestedRisk: null,
    });
  }

  const categories = buildMarketCategories(results, "ABS PPI");
  const summary: string[] = [
    "These are national output price indices by construction category, not a quote for this project's actual work type, region, or supplier — always confirm with current supplier and subcontractor pricing before finalising an escalation allowance.",
  ];

  return NextResponse.json({
    location: locationOut(place),
    source: "Australian Bureau of Statistics — Producer Price Indexes",
    summary,
    categories,
    suggestedRisk: categories[0]?.suggestedRisk ?? null,
  });
}

// ---------- United Kingdom: ONS Producer Price Index ----------

const UK_SERIES: { cdid: string; label: string }[] = [
  { cdid: "GHAV", label: "Steel & metal construction inputs (iron, steel & alloys, tubes, fittings)" },
  { cdid: "EW6K", label: "Concrete products for construction" },
  { cdid: "EW6C", label: "Bricks, tiles & baked clay construction products" },
];

interface OnsPoint {
  sortKey: number;
  step: number;
  label: string;
  value: number;
}

const ONS_MONTH_NUM: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function onsPointsFromArray(arr: any[] | undefined, kind: "quarters" | "months" | "years"): OnsPoint[] {
  if (!Array.isArray(arr)) return [];
  const out: OnsPoint[] = [];
  for (const d of arr) {
    const year = parseInt(d?.year, 10);
    const value = parseFloat(d?.value);
    if (!year || isNaN(value)) continue;
    let sortKey: number;
    let step: number;
    if (kind === "quarters") {
      const q = parseInt(String(d?.quarter || "").replace(/[^0-9]/g, ""), 10);
      if (!q) continue;
      sortKey = year * 10 + q;
      step = 10;
    } else if (kind === "months") {
      const m = ONS_MONTH_NUM[String(d?.month || "").slice(0, 3).toLowerCase()];
      if (!m) continue;
      sortKey = year * 100 + m;
      step = 100;
    } else {
      sortKey = year * 100;
      step = 100;
    }
    out.push({ sortKey, step, label: String(d?.label || d?.date || year), value });
  }
  return out;
}

function yoyFromOnsPoints(points: OnsPoint[]): { latestLabel: string; pct: number } | null {
  if (!points.length) return null;
  const sorted = [...points].sort((a, b) => b.sortKey - a.sortKey);
  const latest = sorted[0];
  const yearAgo = sorted.find((p) => p.sortKey === latest.sortKey - latest.step);
  if (!yearAgo || yearAgo.value === 0) return null;
  return { latestLabel: latest.label, pct: ((latest.value - yearAgo.value) / yearAgo.value) * 100 };
}

async function fetchOnsYoy(cdid: string): Promise<{ yoy: { latestLabel: string; pct: number } | null; diag: string }> {
  const url = `https://api.beta.ons.gov.uk/v1/data?uri=/economy/inflationandpriceindices/timeseries/${cdid.toLowerCase()}/ppi`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: EXTERNAL_API_HEADERS,
  });
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    return { yoy: null, diag: `ONS API returned HTTP ${res.status} for ${cdid}.${bodyText ? ` ${bodyText.slice(0, 200)}` : ""}` };
  }
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    return { yoy: null, diag: `ONS API returned a non-JSON response for ${cdid}: ${text.slice(0, 200)}` };
  }
  // Prefer the finest available frequency, since ONS series switch frequency over time.
  const yoy =
    yoyFromOnsPoints(onsPointsFromArray(json.months, "months")) ||
    yoyFromOnsPoints(onsPointsFromArray(json.quarters, "quarters")) ||
    yoyFromOnsPoints(onsPointsFromArray(json.years, "years"));
  return {
    yoy,
    diag: yoy
      ? ""
      : `ONS response for ${cdid} didn't contain a usable 12-month-apart comparison. Raw response snippet: ${text.slice(0, 300)}`,
  };
}

async function lookupUK(place: GeocodeResult) {
  const results: { label: string; latestLabel: string; pct: number }[] = [];
  let diag = "";

  for (const series of UK_SERIES) {
    try {
      const { yoy, diag: seriesDiag } = await fetchOnsYoy(series.cdid);
      if (yoy) {
        results.push({ label: series.label, latestLabel: yoy.latestLabel, pct: yoy.pct });
      } else if (seriesDiag) {
        diag = seriesDiag;
      }
    } catch (e: any) {
      diag = `Request to ONS API failed: ${e?.message || "unknown error"}.`;
    }
  }

  if (!results.length) {
    return NextResponse.json({
      location: locationOut(place),
      source: "UK Office for National Statistics — Producer Price Index",
      summary: [
        diag
          ? `Automated lookup didn't complete — ${diag} Check ons.gov.uk (Producer Price Index) directly, or add a market risk row manually.`
          : "No usable ONS data was returned for this lookup. Check ons.gov.uk (Producer Price Index) directly, or add a market risk row manually.",
      ],
      categories: [],
      suggestedRisk: null,
    });
  }

  const categories = buildMarketCategories(results, "UK ONS PPI");
  const summary: string[] = [
    "These are individual domestic material price indices, not one blended 'all construction inputs' aggregate — ONS's broader Construction Output Price Index isn't currently available through this automated lookup, so treat this as a materials basket rather than a single headline figure.",
    "This is a national materials cost trend, not a quote for this project's actual material mix, region, or supplier — always confirm with current supplier and subcontractor pricing before finalising an escalation allowance.",
  ];

  return NextResponse.json({
    location: locationOut(place),
    source: "UK Office for National Statistics — Producer Price Index",
    summary,
    categories,
    suggestedRisk: categories[0]?.suggestedRisk ?? null,
  });
}

// ---------- EU member states: Eurostat Construction Producer Price Index ----------

// ISO 3166-1 alpha-2 -> Eurostat "geo" code. Almost all match; Eurostat uses "EL" for Greece.
const EU27_EUROSTAT_GEO: Record<string, string> = {
  AT: "AT", BE: "BE", BG: "BG", HR: "HR", CY: "CY", CZ: "CZ", DK: "DK", EE: "EE", FI: "FI",
  FR: "FR", DE: "DE", GR: "EL", HU: "HU", IE: "IE", IT: "IT", LV: "LV", LT: "LT", LU: "LU",
  MT: "MT", NL: "NL", PL: "PL", PT: "PT", RO: "RO", SK: "SK", SI: "SI", ES: "ES", SE: "SE",
};

function parseEurostatLatest(json: any): { period: string; value: number } | null {
  const timeIndex: Record<string, number> = json?.dimension?.time?.category?.index || {};
  const values: Record<string, any> = json?.value || {};
  const periods = Object.keys(timeIndex);
  if (!periods.length) return null;
  const withValues = periods
    .map((p) => ({ period: p, value: values[String(timeIndex[p])] }))
    .filter((p) => typeof p.value === "number") as { period: string; value: number }[];
  if (!withValues.length) return null;
  withValues.sort((a, b) => b.period.localeCompare(a.period)); // "YYYY-Qn" sorts correctly lexicographically
  return withValues[0];
}

async function lookupEU(place: GeocodeResult, geoCode: string, countryLabel: string) {
  const thisYear = new Date().getFullYear();
  const params = new URLSearchParams({
    format: "JSON",
    freq: "Q",
    indic_bt: "PRC_PRR",
    cpa2_1: "CPA_F41001_X_410014",
    s_adj: "NSA",
    unit: "PCH_SM", // percentage change on same period (quarter) of previous year — pre-computed by Eurostat
    geo: geoCode,
    lang: "en",
    sinceTimePeriod: `${thisYear - 2}-Q1`,
  });
  const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sts_copi_q?${params.toString()}`;

  let diag = "";
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: EXTERNAL_API_HEADERS,
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      diag = `Eurostat returned HTTP ${res.status}.${bodyText ? ` ${bodyText.slice(0, 200)}` : ""}`;
    } else {
      const json = await res.json().catch(() => null);
      const parsed = json ? parseEurostatLatest(json) : null;
      if (parsed) {
        const label = `Construction producer prices, new residential buildings (${countryLabel})`;
        const summary: string[] = [
          "This tracks new residential building construction specifically, not civil infrastructure, and isn't a quote for this project's actual material mix or region — always confirm with current supplier and subcontractor pricing before finalising an escalation allowance.",
        ];
        const categories = buildMarketCategories([{ label, latestLabel: parsed.period, pct: parsed.value }], "Eurostat");
        return NextResponse.json({
          location: locationOut(place),
          source: "Eurostat — Construction Producer Price Index",
          summary,
          categories,
          suggestedRisk: categories[0]?.suggestedRisk ?? null,
        });
      }
      diag = "No usable Eurostat data was returned for this country.";
    }
  } catch (e: any) {
    diag = `Request to Eurostat failed: ${e?.message || "unknown error"}.`;
  }

  return NextResponse.json({
    location: locationOut(place),
    source: "Eurostat — Construction Producer Price Index",
    summary: [`Automated lookup didn't complete — ${diag} Check ec.europa.eu/eurostat directly, or add a market risk row manually.`],
    categories: [],
    suggestedRisk: null,
  });
}
