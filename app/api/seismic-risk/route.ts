import { NextResponse } from "next/server";

/**
 * Seismic risk lookup.
 *
 * United States  -> USGS Design Maps web service — free, keyless, returns
 *                   code-ready seismic design parameters (incl. Seismic
 *                   Design Category) straight from lat/long.
 *                   https://earthquake.usgs.gov/ws/designmaps/
 * Australia      -> Geoscience Australia's National Seismic Hazard
 *                   Assessment 2018 — free, keyless ArcGIS "identify" on
 *                   the 10%-in-50-years peak ground acceleration layer
 *                   (the basis for AS 1170.4).
 *                   https://services.ga.gov.au/gis/rest/services/National_Seismic_Hazard_Assessment_2018/MapServer
 *
 * Both are free, government-run, no-account desktop indicators — useful as
 * an early warning sign, never a substitute for a project-specific seismic
 * design assessment by a structural engineer before pricing seismic
 * detailing or bracing allowances.
 *
 * A generic Risk Category II / Site Class D is assumed for the US lookup,
 * since the app doesn't collect building importance or site soil class
 * elsewhere — always confirm with the project's structural engineer once
 * those are known.
 *
 * GET /api/seismic-risk?location=Ipswich%2C%20QLD
 */

interface GeocodeResult {
  name: string;
  country?: string;
  country_code?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

type SuggestedRisk = { category: "seismic"; description: string; probability: number } | null;

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
        `Automated seismic data isn't wired up yet for ${place.country || "this country"} — it currently covers the United States (USGS) and Australia (Geoscience Australia). Add a seismic risk row manually below if relevant to this site.`,
      ],
      suggestedRisk: null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unexpected error looking up seismic risk." }, { status: 500 });
  }
}

// ---------- United States: USGS Design Maps (ASCE 7-22) ----------

async function lookupUS(place: GeocodeResult) {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    riskCategory: "II",
    siteClass: "D",
    title: "Ground Truth Estimator lookup",
  });
  const url = `https://earthquake.usgs.gov/ws/designmaps/asce7-22.json?${params.toString()}`;

  let data: any = null;
  let diag = "";
  try {
    const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      diag = `USGS service returned HTTP ${res.status}. ${bodyText.slice(0, 200)}`;
    } else {
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        diag = `USGS service returned a non-JSON response: ${text.slice(0, 200)}`;
      }
    }
  } catch (e: any) {
    diag = `Request to USGS service failed: ${e?.message || "unknown error"}.`;
  }

  const d = data?.response?.data;
  if (!d || typeof d.sdc !== "string") {
    return NextResponse.json({
      location: locationOut(place),
      source: "USGS Design Maps (ASCE 7-22)",
      summary: [
        diag
          ? `Automated lookup didn't complete — ${diag}`
          : "No seismic design data was returned for this exact point — this can happen just outside US coverage (e.g. far offshore). Add a seismic risk row manually if relevant.",
      ],
      suggestedRisk: null,
    });
  }

  const sdc: string = d.sdc;
  const ss = typeof d.ss === "number" ? d.ss : null;
  const s1 = typeof d.s1 === "number" ? d.s1 : null;

  const summary: string[] = [];
  summary.push(
    `USGS Design Maps returns Seismic Design Category ${sdc} for this site (ASCE 7-22, Risk Category II, assumed Site Class D)${ss !== null ? ` — Ss = ${ss.toFixed(2)}g, S1 = ${s1?.toFixed(2)}g` : ""}.`
  );

  let suggested: SuggestedRisk = null;
  if (sdc === "D") {
    summary.push("Category D requires seismic detailing under most US building codes — allow for engineered lateral bracing/detailing in the estimate.");
    suggested = { category: "seismic", description: `Seismic Design Category D — allow for engineered lateral bracing / seismic detailing per ASCE 7`, probability: 25 };
  } else if (sdc === "E" || sdc === "F") {
    summary.push(`Category ${sdc} is a high-seismicity zone (near major fault) — significant lateral design and detailing requirements apply.`);
    suggested = { category: "seismic", description: `High seismic zone (Design Category ${sdc}) — significant lateral bracing / detailing allowance required`, probability: 40 };
  } else if (sdc === "C") {
    summary.push("Category C is moderate seismicity — some lateral detailing requirements typically apply, less onerous than D–F.");
    suggested = { category: "seismic", description: `Moderate seismic zone (Design Category C) — check lateral detailing requirements`, probability: 15 };
  } else {
    summary.push(`Category ${sdc} is low seismicity — seismic detailing requirements are typically minimal here.`);
  }

  summary.push(
    "This is a desktop code-parameter lookup (Risk Category II / Site Class D assumed), not a substitute for a project-specific seismic assessment — confirm actual site class and risk category with the structural engineer."
  );

  return NextResponse.json({
    location: locationOut(place),
    source: "USGS Design Maps (ASCE 7-22)",
    summary,
    suggestedRisk: suggested,
  });
}

// ---------- Australia: Geoscience Australia National Seismic Hazard Assessment 2018 ----------

async function lookupAU(place: GeocodeResult) {
  const lon = place.longitude;
  const lat = place.latitude;
  const d = 0.05;
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: "esriGeometryPoint",
    sr: "4326",
    layers: "visible:16", // Peak_Ground_Acceleration_map_10pct — 10% in 50yr, the AS1170.4 basis
    tolerance: "2",
    mapExtent: `${lon - d},${lat - d},${lon + d},${lat + d}`,
    imageDisplay: "400,400,96",
    returnGeometry: "false",
    f: "json",
  });
  const url = `https://services.ga.gov.au/gis/rest/services/National_Seismic_Hazard_Assessment_2018/MapServer/identify?${params.toString()}`;

  let data: any = null;
  let diag = "";
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (compatible; GroundTruthEstimator/1.0)" },
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      diag = `Geoscience Australia service returned HTTP ${res.status}. ${bodyText.slice(0, 200)}`;
    } else {
      const text = await res.text();
      try {
        data = JSON.parse(text);
        if (data?.error) diag = `Geoscience Australia service returned an error: ${JSON.stringify(data.error).slice(0, 200)}`;
      } catch {
        diag = `Geoscience Australia service returned a non-JSON response: ${text.slice(0, 200)}`;
      }
    }
  } catch (e: any) {
    diag = `Request to Geoscience Australia service failed: ${e?.message || "unknown error"}.`;
  }

  const results: any[] = data?.results || [];
  const first = results[0];
  // Raster identify: value usually sits in results[0].value, and again in
  // attributes["Pixel Value"] — try both, then fall back to any numeric
  // attribute found, mirroring the defensive approach used for the AU soil lookup.
  let pga: number | null = null;
  if (first) {
    const direct = parseFloat(first.value);
    if (!isNaN(direct)) pga = direct;
    if (pga === null && first.attributes) {
      const attrs: Record<string, any> = first.attributes;
      const pixelKey = Object.keys(attrs).find((k) => /pixel/i.test(k));
      const candidate = pixelKey ? parseFloat(attrs[pixelKey]) : NaN;
      if (!isNaN(candidate)) pga = candidate;
      else {
        for (const v of Object.values(attrs)) {
          const n = parseFloat(v as any);
          if (!isNaN(n)) { pga = n; break; }
        }
      }
    }
  }

  if (pga === null) {
    return NextResponse.json({
      location: locationOut(place),
      source: "Geoscience Australia National Seismic Hazard Assessment (2018)",
      summary: [
        diag
          ? `Automated lookup didn't complete — ${diag}`
          : "No seismic hazard value was returned for this exact point. Check Geoscience Australia's hazard portal by hand, or add a seismic risk row manually if relevant.",
      ],
      suggestedRisk: null,
    });
  }

  const summary: string[] = [];
  summary.push(
    `Geoscience Australia's National Seismic Hazard Assessment (2018) gives a design peak ground acceleration of approximately ${pga.toFixed(3)}g at this site (10% chance of exceedance in 50 years — the basis for AS 1170.4).`
  );

  let suggested: SuggestedRisk = null;
  if (pga >= 0.22) {
    summary.push("This is a relatively high PGA for Australia — significant lateral design and detailing requirements are likely under AS 1170.4.");
    suggested = { category: "seismic", description: `Elevated seismic hazard (PGA ≈ ${pga.toFixed(2)}g) — allow for AS 1170.4 lateral design and detailing`, probability: 35 };
  } else if (pga >= 0.12) {
    summary.push("This is a moderate-to-high PGA — check AS 1170.4 requirements for lateral bracing/detailing at this hazard level.");
    suggested = { category: "seismic", description: `Moderate seismic hazard (PGA ≈ ${pga.toFixed(2)}g) — check AS 1170.4 lateral bracing requirements`, probability: 20 };
  } else if (pga >= 0.08) {
    summary.push("This is a moderate PGA by Australian standards — minor lateral detailing may apply under AS 1170.4.");
    suggested = { category: "seismic", description: `Moderate seismic hazard (PGA ≈ ${pga.toFixed(2)}g) — confirm AS 1170.4 detailing requirements`, probability: 10 };
  } else {
    summary.push("This is a low PGA, typical of most of Australia — seismic detailing requirements are usually minimal at this hazard level.");
  }

  summary.push(
    "This is a desktop hazard-map indicator, not a substitute for a project-specific AS 1170.4 seismic assessment by a structural engineer."
  );

  return NextResponse.json({
    location: locationOut(place),
    source: "Geoscience Australia National Seismic Hazard Assessment (2018)",
    summary,
    suggestedRisk: suggested,
  });
}
