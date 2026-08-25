import { NextResponse } from "next/server";

/**
 * Geotechnical / soil risk lookup.
 *
 * United States  -> USDA Soil Data Access (SDA) — free, keyless SSURGO soil
 *                   survey web service. https://sdmdataaccess.nrcs.usda.gov
 * Australia      -> CSIRO's national Australian Soil Classification map,
 *                   served as a public ArcGIS "Identify" service.
 *                   https://asris.csiro.au
 *
 * Both are free, government-run, no-account desktop soil datasets — useful
 * as an early warning sign, never a substitute for a site-specific
 * geotechnical investigation (bores / test pits) before pricing footings,
 * pavement subgrade, or earthworks.
 *
 * GET /api/geotech-risk?location=Ipswich%2C%20QLD
 */

interface GeocodeResult {
  name: string;
  country?: string;
  country_code?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

type SuggestedRisk = { category: "geotechnical"; description: string; probability: number } | null;

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

    if (isUS) return await lookupUS(place);
    if (isAU) return await lookupAU(place);

    return NextResponse.json({
      location: locationOut(place),
      source: null,
      summary: [
        `Automated soil data isn't wired up yet for ${place.country || "this country"} — it currently covers the United States (USDA) and Australia (CSIRO). Add a geotechnical risk row manually below, or commission a site geotechnical investigation.`,
      ],
      suggestedRisk: null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unexpected error looking up geotechnical risk." }, { status: 500 });
  }
}

// ---------- United States: USDA Soil Data Access (SSURGO) ----------

async function lookupUS(place: GeocodeResult) {
  const sql = `SELECT TOP 1 mu.muname, co.compname, co.comppct_r, co.drainagecl, co.hydricrating
FROM mapunit mu
INNER JOIN component co ON co.mukey = mu.mukey
WHERE mu.mukey IN (
  SELECT * FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('point(${place.longitude} ${place.latitude})')
)
ORDER BY co.comppct_r DESC`;

  let data: any = null;
  try {
    const sdaRes = await fetch("https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: sql, format: "JSON+COLUMNNAME" }),
      cache: "no-store",
    });
    if (sdaRes.ok) data = await sdaRes.json().catch(() => null);
  } catch {
    data = null;
  }

  const table: any[][] | undefined = data?.Table;
  if (!table || table.length < 2) {
    return NextResponse.json({
      location: locationOut(place),
      source: "USDA Soil Data Access (SSURGO)",
      summary: [
        "No mapped SSURGO soil survey data was found at this exact point — this can happen over water, very remote areas, or where the county hasn't been digitally surveyed yet. Commission a site geotechnical investigation.",
      ],
      suggestedRisk: null,
    });
  }

  const header: string[] = table[0];
  const row: any[] = table[1];
  const rec: Record<string, any> = {};
  header.forEach((h, i) => (rec[h] = row[i]));

  const muname = rec.muname || "an unnamed soil map unit";
  const compname = rec.compname || "";
  const drainagecl: string = rec.drainagecl || "";
  const hydricrating: string = rec.hydricrating || "";

  const summary: string[] = [];
  summary.push(
    `USDA soil survey data (SSURGO) maps this point as "${muname}"${compname ? `, dominant component "${compname}"` : ""}.`
  );

  let suggested: SuggestedRisk = null;

  if (drainagecl) {
    summary.push(`Drainage class: ${drainagecl}.`);
    if (["poorly drained", "very poorly drained", "somewhat poorly drained"].includes(drainagecl.toLowerCase())) {
      summary.push(
        "Poorly-drained soils increase the risk of wet-weather trafficability issues and can require subsoil drainage or an imported working platform — worth an allowance in earthworks and footings."
      );
      suggested = {
        category: "geotechnical",
        description: `Poor site drainage (${drainagecl}) — allow for subsoil drainage / working platform in earthworks and footings`,
        probability: 35,
      };
    }
  }

  if (hydricrating && !["no", "not rated", "unranked"].includes(hydricrating.toLowerCase())) {
    summary.push(
      `This soil unit carries a hydric rating of "${hydricrating}" — a wetland / seasonal-waterlogging indicator worth checking against local wetland regulations before excavation.`
    );
    if (!suggested) {
      suggested = {
        category: "geotechnical",
        description: `Hydric soil rating (${hydricrating}) — check wetland / waterlogging constraints before excavation`,
        probability: 30,
      };
    }
  }

  summary.push(
    "This is a desktop soil-survey indicator, not a substitute for a site-specific geotechnical investigation — always confirm with bores or test pits before pricing footings or pavement subgrade."
  );

  return NextResponse.json({
    location: locationOut(place),
    source: "USDA Soil Data Access (SSURGO)",
    summary,
    suggestedRisk: suggested,
  });
}

// ---------- Australia: CSIRO Australian Soil Classification ----------

async function lookupAU(place: GeocodeResult) {
  const lon = place.longitude;
  const lat = place.latitude;
  const d = 0.05;
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: "esriGeometryPoint",
    sr: "4326",
    layers: "all",
    tolerance: "5",
    mapExtent: `${lon - d},${lat - d},${lon + d},${lat + d}`,
    imageDisplay: "400,400,96",
    returnGeometry: "false",
    f: "json",
  });
  const url = `https://asris.csiro.au/arcgis/rest/services/TERN/ASC_ACLEP_AU_NAT_C/MapServer/identify?${params.toString()}`;

  let data: any = null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) data = await res.json().catch(() => null);
  } catch {
    data = null;
  }

  const results: any[] = data?.results || [];
  if (!results.length) {
    return NextResponse.json({
      location: locationOut(place),
      source: "CSIRO Australian Soil Classification",
      summary: [
        "No classified soil data was returned for this exact point from CSIRO's national soil classification layer. Commission a site geotechnical investigation.",
      ],
      suggestedRisk: null,
    });
  }

  const attrs: Record<string, any> = results[0].attributes || {};
  const preferredKeyPattern = /(class|order|name|type|soil|group)/i;
  const preferredEntry = Object.entries(attrs).find(
    ([k, v]) => preferredKeyPattern.test(k) && typeof v === "string" && v.trim().length > 0 && !/objectid|shape/i.test(k)
  );
  const classification = preferredEntry ? String(preferredEntry[1]) : null;

  if (!classification) {
    return NextResponse.json({
      location: locationOut(place),
      source: "CSIRO Australian Soil Classification",
      summary: [
        "Soil data was found for this point, but the classification couldn't be confidently read from the response. Treat this as inconclusive and commission a site geotechnical investigation.",
      ],
      suggestedRisk: null,
    });
  }

  const summary: string[] = [];
  summary.push(`CSIRO's national Australian Soil Classification layer maps this point as "${classification}".`);

  let suggested: SuggestedRisk = null;
  const c = classification.toLowerCase();

  if (c.includes("vertosol")) {
    summary.push(
      "Vertosols are clay-rich, highly reactive (shrink-swell) soils — a major driver of footing and slab movement, and pavement distress, across Australia. Allow for a site-specific AS 2870 reactivity classification and consider deeper or stiffened footings."
    );
    suggested = {
      category: "geotechnical",
      description: "Reactive clay soil (Vertosol) — allow for AS 2870 site classification and stiffened/deeper footings",
      probability: 45,
    };
  } else if (c.includes("sodosol") || c.includes("hydrosol") || c.includes("kurosol")) {
    summary.push(
      "This soil order is commonly associated with poor drainage or dispersive/sodic subsoils — worth checking for waterlogging risk and potential erosion or tunnelling in cut batters."
    );
    suggested = {
      category: "geotechnical",
      description: `${classification} soils — check drainage and dispersive/sodic subsoil risk before earthworks`,
      probability: 30,
    };
  } else if (c.includes("rudosol") || c.includes("tenosol")) {
    summary.push(
      "Shallow, weakly-developed soils here often indicate rock or a shallow water table close to the surface — worth an early bore or test pit to confirm founding depth."
    );
    suggested = {
      category: "geotechnical",
      description: `Shallow/rocky soil profile (${classification}) — confirm founding depth with a test pit before pricing footings`,
      probability: 30,
    };
  }

  summary.push(
    "This is a broad-scale desktop soil classification, not a substitute for a site-specific geotechnical investigation and AS 2870 site classification."
  );

  return NextResponse.json({
    location: locationOut(place),
    source: "CSIRO Australian Soil Classification",
    summary,
    suggestedRisk: suggested,
  });
}
