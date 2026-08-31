import { NextResponse } from "next/server";

/**
 * Flood risk lookup.
 *
 * United States  -> FEMA National Flood Hazard Layer (NFHL) — free, keyless
 *                   ArcGIS REST service, queried directly at the site point.
 *                   https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28
 *
 * A free, government-run, no-account point lookup — useful as an early
 * warning sign, never a substitute for pulling the actual FIRM panel and
 * confirming with a licensed surveyor's elevation certificate before
 * pricing flood-proofing, freeboard, or insurance allowances.
 *
 * GET /api/flood-risk?location=Ipswich%2C%20QLD
 */

interface GeocodeResult {
  name: string;
  country?: string;
  country_code?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

type SuggestedRisk = { category: "flood"; description: string; probability: number } | null;

function locationOut(place: GeocodeResult) {
  return {
    name: place.name,
    state: place.admin1 || null,
    country: place.country || null,
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

// Case-insensitive attribute lookup — ArcGIS services aren't always
// consistent about field-name casing between mirrors/versions.
function attr(rec: Record<string, any>, name: string): any {
  const key = Object.keys(rec).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? rec[key] : undefined;
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

    if (isUS) return await lookupUS(place);

    return NextResponse.json({
      location: locationOut(place),
      source: null,
      summary: [
        `Automated flood data isn't wired up yet for ${place.country || "this country"} — it currently covers the United States (FEMA). Add a flood risk row manually below, or check your local council/state flood mapping tool for this site.`,
      ],
      suggestedRisk: null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unexpected error looking up flood risk." }, { status: 500 });
  }
}

// ---------- United States: FEMA National Flood Hazard Layer ----------

async function lookupUS(place: GeocodeResult) {
  const params = new URLSearchParams({
    geometry: `${place.longitude},${place.latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE",
    returnGeometry: "false",
    f: "json",
  });
  const url = `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?${params.toString()}`;

  let data: any = null;
  let diag = "";
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (compatible; GroundTruthEstimator/1.0)" },
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      diag = `FEMA service returned HTTP ${res.status}. ${bodyText.slice(0, 200)}`;
    } else {
      const text = await res.text();
      try {
        data = JSON.parse(text);
        if (data?.error) diag = `FEMA service returned an error: ${JSON.stringify(data.error).slice(0, 200)}`;
      } catch {
        diag = `FEMA service returned a non-JSON response: ${text.slice(0, 200)}`;
      }
    }
  } catch (e: any) {
    diag = `Request to FEMA service failed: ${e?.message || "unknown error"}.`;
  }

  const features: any[] = data?.features || [];
  if (!features.length) {
    return NextResponse.json({
      location: locationOut(place),
      source: "FEMA National Flood Hazard Layer",
      summary: [
        diag
          ? `Automated lookup didn't complete — ${diag}`
          : "No FEMA flood map data was found at this exact point — this can happen where FEMA hasn't digitized a study (unmapped county) or offshore. Check the FEMA Flood Map Service Center (msc.fema.gov) by hand, or add a flood risk row manually.",
      ],
      suggestedRisk: null,
    });
  }

  const rec: Record<string, any> = features[0].attributes || {};
  const zone = String(attr(rec, "FLD_ZONE") ?? "").trim();
  const subty = String(attr(rec, "ZONE_SUBTY") ?? "").trim();
  const sfha = String(attr(rec, "SFHA_TF") ?? "").trim().toUpperCase();
  const bfeRaw = attr(rec, "STATIC_BFE");
  const bfe = typeof bfeRaw === "number" && bfeRaw > -9000 ? bfeRaw : null;

  const summary: string[] = [];
  let suggested: SuggestedRisk = null;

  if (!zone) {
    summary.push(
      "FEMA flood map data was found at this point but didn't carry a readable zone code — treat as inconclusive and check the FEMA Flood Map Service Center (msc.fema.gov) directly."
    );
  } else if (sfha === "T" && zone.startsWith("V")) {
    summary.push(
      `This site is mapped in FEMA Special Flood Hazard Area, Zone ${zone}${subty ? ` (${subty})` : ""} — a high-risk coastal zone with storm-surge and wave-action exposure, the most severe FEMA flood category.${bfe !== null ? ` Base Flood Elevation: ${bfe} ft.` : ""}`
    );
    suggested = {
      category: "flood",
      description: `High-risk coastal flood zone (${zone}) — storm surge / wave action, likely triggers flood-proofing, freeboard and elevated-foundation requirements`,
      probability: 45,
    };
  } else if (sfha === "T") {
    summary.push(
      `This site is mapped in FEMA Special Flood Hazard Area, Zone ${zone}${subty ? ` (${subty})` : ""} — the 1%-annual-chance (100-year) floodplain.${bfe !== null ? ` Base Flood Elevation: ${bfe} ft.` : ""}`
    );
    suggested = {
      category: "flood",
      description: `Site within 1% annual chance (100-year) floodplain (Zone ${zone}) — allow for flood-proofing, freeboard, or elevated foundations, and check local floodplain ordinance`,
      probability: 35,
    };
  } else if (zone === "D") {
    summary.push(
      "This area is Zone D — flood hazard here hasn't been studied or determined by FEMA. Treat as an unknown, not as low-risk; a site-specific flood study may be warranted."
    );
    suggested = {
      category: "flood",
      description: "Flood hazard undetermined (FEMA Zone D, unstudied area) — consider commissioning a flood study before pricing",
      probability: 20,
    };
  } else if (subty.toUpperCase().includes("0.2 PCT")) {
    summary.push(
      `This site sits in FEMA's 0.2%-annual-chance (500-year) flood zone, Zone ${zone} — a moderate-risk area outside the mapped Special Flood Hazard Area.`
    );
    suggested = {
      category: "flood",
      description: `0.2% annual chance (500-year) flood zone (${zone}) — moderate risk, worth a contingency allowance for extreme events`,
      probability: 15,
    };
  } else {
    summary.push(
      `This site is mapped as Zone ${zone} — outside FEMA's mapped Special Flood Hazard Area (minimal flood hazard on current FEMA mapping).`
    );
  }

  summary.push(
    "This is a desktop FEMA-mapping indicator, not a substitute for pulling the actual FIRM panel or a surveyor's elevation certificate — always confirm before pricing flood-proofing or insurance allowances."
  );

  return NextResponse.json({
    location: locationOut(place),
    source: "FEMA National Flood Hazard Layer",
    summary,
    suggestedRisk: suggested,
  });
}
