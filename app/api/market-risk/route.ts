import { NextResponse } from "next/server";

/**
 * Market / price escalation risk lookup.
 *
 * United States -> BLS Producer Price Index (PPI), free keyless public API.
 *                  https://www.bls.gov/developers/api_signature_v2.htm
 *                  Index-number series — this route pulls the raw index
 *                  values itself and computes the 12-month % change by hand.
 *
 * Australia     -> ABS Data API, free keyless SDMX-JSON API.
 *                  https://data.api.abs.gov.au — PPI dataflow, "House
 *                  Construction Inputs" (materials used in house building).
 *                  ABS pre-computes the 12-month % change (MEASURE=3), so
 *                  this route just reads that figure straight off.
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
      suggestedRisk: null,
    });
  }

  const summary: string[] = [];
  const headline = results.find((r) => r.label === US_SERIES[0].label) || results[0];
  summary.push(
    `${headline.label}: ${headline.pct >= 0 ? "up" : "down"} ${Math.abs(headline.pct).toFixed(1)}% over the 12 months to ${headline.latestLabel} (US BLS Producer Price Index).`
  );
  for (const r of results) {
    if (r === headline) continue;
    summary.push(`${r.label}: ${r.pct >= 0 ? "up" : "down"} ${Math.abs(r.pct).toFixed(1)}% over the 12 months to ${r.latestLabel} (BLS PPI).`);
  }
  summary.push(
    "This is a national materials/input cost trend, not a quote for this project's actual material mix, region, or supplier — always confirm with current supplier and subcontractor pricing before finalising an escalation allowance."
  );

  const suggested = riskFromYoyPct(headline.pct, headline.label, "US BLS PPI");

  return NextResponse.json({
    location: locationOut(place),
    source: "US Bureau of Labor Statistics — Producer Price Index",
    summary,
    suggestedRisk: suggested,
  });
}

// ---------- Australia: ABS Data API — Producer Price Indexes ----------

const AU_SERIES: { key: string; label: string }[] = [
  // MEASURE.INDEX.TYPE.FREQ — MEASURE 3 = "% change from corresponding quarter of previous year" (ABS pre-computes this).
  { key: "3.8102825.INPUT.Q", label: "Construction materials cost inflation (House Construction Inputs, all groups)" },
];

function parseAbsLatestValue(json: any): { latestLabel: string; value: number } | null {
  const timeValues: { id: string }[] = json?.data?.structure?.dimensions?.observation?.[0]?.values || [];
  const seriesObj = json?.data?.dataSets?.[0]?.series || {};
  const seriesKey = Object.keys(seriesObj)[0];
  if (!seriesKey) return null;
  const obs: Record<string, any[]> = seriesObj[seriesKey]?.observations || {};
  const points = Object.entries(obs)
    .map(([idx, arr]) => ({
      period: timeValues[parseInt(idx, 10)]?.id,
      value: Array.isArray(arr) && typeof arr[0] === "number" ? arr[0] : null,
    }))
    .filter((p) => p.period && p.value !== null) as { period: string; value: number }[];
  if (!points.length) return null;
  points.sort((a, b) => b.period.localeCompare(a.period)); // "YYYY-Qn" sorts correctly lexicographically
  return { latestLabel: points[0].period, value: points[0].value };
}

async function lookupAU(place: GeocodeResult) {
  const thisYear = new Date().getFullYear();
  const results: { label: string; latestLabel: string; pct: number }[] = [];
  let diag = "";

  for (const series of AU_SERIES) {
    try {
      const url = `https://data.api.abs.gov.au/rest/data/ABS,PPI/${series.key}?startPeriod=${thisYear - 2}-Q1&format=jsondata`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: EXTERNAL_API_HEADERS,
      });
      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        diag = `ABS Data API returned HTTP ${res.status}.${bodyText ? ` ${bodyText.slice(0, 200)}` : ""}`;
        continue;
      }
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        diag = `ABS Data API returned a non-JSON response (HTTP ${res.status}): ${text.slice(0, 300)}`;
        continue;
      }
      const apiErrors = json?.errors || json?.data?.errors;
      const parsed = parseAbsLatestValue(json);
      if (parsed) {
        results.push({ label: series.label, latestLabel: parsed.latestLabel, pct: parsed.value });
      } else if (apiErrors && (Array.isArray(apiErrors) ? apiErrors.length : true)) {
        diag = `ABS Data API returned an error payload: ${JSON.stringify(apiErrors).slice(0, 300)}`;
      } else {
        // Parsed OK as JSON (HTTP 200) but the shape we expected wasn't there. The response's
        // "meta" header alone runs past a short text slice before ever reaching "data" — so
        // report specifically on the "data" section (dataSets/series/observation counts plus a
        // snippet of it) rather than the raw text, which would just show meta boilerplate again.
        const d = json?.data;
        const diagFacts = {
          hasData: !!d,
          dataSetsLength: Array.isArray(d?.dataSets) ? d.dataSets.length : null,
          seriesKeysFound: Object.keys(d?.dataSets?.[0]?.series || {}).length,
          timeValuesFound: (d?.structure?.dimensions?.observation?.[0]?.values || []).length,
          dataSnippet: JSON.stringify(d).slice(0, 250),
        };
        diag = `ABS response (HTTP ${res.status}) didn't contain a usable observation. ${JSON.stringify(diagFacts)}`;
      }
    } catch (e: any) {
      diag = `Request to ABS Data API failed: ${e?.message || "unknown error"}.`;
    }
  }

  if (!results.length) {
    return NextResponse.json({
      location: locationOut(place),
      source: "Australian Bureau of Statistics — Producer Price Indexes",
      summary: [
        diag
          ? `Automated lookup didn't complete — ${diag} Check abs.gov.au (Producer Price Indexes, Australia) directly, or add a market risk row manually.`
          : "No usable ABS data was returned for this lookup. Check abs.gov.au (Producer Price Indexes, Australia) directly, or add a market risk row manually.",
      ],
      suggestedRisk: null,
    });
  }

  const headline = results[0];
  const summary: string[] = [
    `${headline.label}: ${headline.pct >= 0 ? "up" : "down"} ${Math.abs(headline.pct).toFixed(1)}% over the 12 months to ${headline.latestLabel} (ABS Producer Price Indexes).`,
    "ABS publishes this as an input cost index for house building — it's the closest free national indicator of Australian construction materials cost inflation, but it isn't civil-infrastructure-specific and isn't a quote for this project's actual material mix or region.",
    "This is a national materials cost trend, not a quote for this project's actual material mix, region, or supplier — always confirm with current supplier and subcontractor pricing before finalising an escalation allowance.",
  ];

  const suggested = riskFromYoyPct(headline.pct, headline.label, "ABS PPI");

  return NextResponse.json({
    location: locationOut(place),
    source: "Australian Bureau of Statistics — Producer Price Indexes",
    summary,
    suggestedRisk: suggested,
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
      suggestedRisk: null,
    });
  }

  const headline = results[0];
  const summary: string[] = [
    `${headline.label}: ${headline.pct >= 0 ? "up" : "down"} ${Math.abs(headline.pct).toFixed(1)}% over the 12 months to ${headline.latestLabel} (UK ONS Producer Price Index).`,
  ];
  for (const r of results) {
    if (r === headline) continue;
    summary.push(`${r.label}: ${r.pct >= 0 ? "up" : "down"} ${Math.abs(r.pct).toFixed(1)}% over the 12 months to ${r.latestLabel} (ONS PPI).`);
  }
  summary.push(
    "These are individual domestic material price indices, not one blended 'all construction inputs' aggregate — ONS's broader Construction Output Price Index isn't currently available through this automated lookup, so treat this as a materials basket rather than a single headline figure."
  );
  summary.push(
    "This is a national materials cost trend, not a quote for this project's actual material mix, region, or supplier — always confirm with current supplier and subcontractor pricing before finalising an escalation allowance."
  );

  const suggested = riskFromYoyPct(headline.pct, headline.label, "UK ONS PPI");

  return NextResponse.json({
    location: locationOut(place),
    source: "UK Office for National Statistics — Producer Price Index",
    summary,
    suggestedRisk: suggested,
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
          `${label}: ${parsed.value >= 0 ? "up" : "down"} ${Math.abs(parsed.value).toFixed(1)}% over the 12 months to ${parsed.period} (Eurostat).`,
          "This tracks new residential building construction specifically, not civil infrastructure, and isn't a quote for this project's actual material mix or region — always confirm with current supplier and subcontractor pricing before finalising an escalation allowance.",
        ];
        const suggested = riskFromYoyPct(parsed.value, label, "Eurostat");
        return NextResponse.json({
          location: locationOut(place),
          source: "Eurostat — Construction Producer Price Index",
          summary,
          suggestedRisk: suggested,
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
    suggestedRisk: null,
  });
}
