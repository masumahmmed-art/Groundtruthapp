import { NextResponse } from "next/server";

/**
 * Location & weather risk lookup, backed by Open-Meteo (open-meteo.com) —
 * a free, keyless weather/climate API. No account or API key is required
 * for the volumes an estimating tool like this generates; see their docs
 * if you outgrow the free tier: https://open-meteo.com/en/pricing
 *
 * GET /api/weather-risk?location=Ipswich%2C%20QLD&months=11,12,1,2,3
 *   months = optional comma-separated list of 1-12 covering the planned
 *   construction programme, used to tailor the summary.
 */

interface GeocodeResult {
  name: string;
  country?: string;
  admin1?: string; // state/region
  latitude: number;
  longitude: number;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const location = searchParams.get("location")?.trim();
  const monthsParam = searchParams.get("months");
  const programmeMonths = monthsParam
    ? monthsParam.split(",").map((m) => parseInt(m, 10)).filter((m) => m >= 1 && m <= 12)
    : [];

  if (!location) {
    return NextResponse.json({ error: "Missing ?location=" }, { status: 400 });
  }

  try {
    // 1. Geocode the free-text location to lat/lon.
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`,
      { cache: "no-store" }
    );
    if (!geoRes.ok) {
      return NextResponse.json({ error: "Location lookup failed. Try a more specific location (suburb + state)." }, { status: 502 });
    }
    const geoJson = await geoRes.json();
    const place: GeocodeResult | undefined = geoJson?.results?.[0];
    if (!place) {
      return NextResponse.json({ error: `Couldn't find "${location}". Try a nearby town or "Suburb, STATE".` }, { status: 404 });
    }

    // 2. Rule-of-thumb cyclone season exposure: coastal/inland Australia
    // north of roughly -26° latitude sits within BOM's broad cyclone
    // outlook region (Nov-Apr season). This is a planning heuristic, not
    // a forecast — always confirm against the current BOM cyclone outlook.
    const cycloneZone = place.latitude >= -26 && place.latitude <= 0;

    // 3. Historical daily climate for the last 5 complete calendar years,
    // aggregated by calendar month, to characterise a typical year.
    const nowYear = new Date().getUTCFullYear();
    const startYear = nowYear - 5;
    const endYear = nowYear - 1;

    const archiveRes = await fetch(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${place.latitude}&longitude=${place.longitude}` +
        `&start_date=${startYear}-01-01&end_date=${endYear}-12-31` +
        `&daily=precipitation_sum,temperature_2m_max&timezone=auto`,
      { cache: "no-store" }
    );
    if (!archiveRes.ok) {
      return NextResponse.json(
        { error: "Climate data lookup failed for this location. You can still add a risk row manually." },
        { status: 502 }
      );
    }
    const archiveJson = await archiveRes.json();
    const dates: string[] = archiveJson?.daily?.time || [];
    const precip: (number | null)[] = archiveJson?.daily?.precipitation_sum || [];
    const tmax: (number | null)[] = archiveJson?.daily?.temperature_2m_max || [];

    if (!dates.length) {
      return NextResponse.json(
        { error: "No historical climate data returned for this location. You can still add a risk row manually." },
        { status: 502 }
      );
    }

    const perMonth = Array.from({ length: 12 }, () => ({ rainfallSum: 0, rainyDays: 0, hotDays: 0, dayCount: 0 }));
    dates.forEach((d, i) => {
      const month = parseInt(d.slice(5, 7), 10) - 1; // 0-indexed
      const p = precip[i] ?? 0;
      const t = tmax[i];
      perMonth[month].dayCount += 1;
      perMonth[month].rainfallSum += p;
      if (p >= 1) perMonth[month].rainyDays += 1;
      if (t !== null && t !== undefined && t >= 35) perMonth[month].hotDays += 1;
    });

    const yearsCovered = endYear - startYear + 1;
    const monthly = perMonth.map((m, idx) => ({
      month: idx + 1,
      label: MONTH_NAMES[idx],
      avgRainfallMm: Math.round((m.rainfallSum / yearsCovered) * 10) / 10,
      avgRainyDays: Math.round((m.rainyDays / yearsCovered) * 10) / 10,
      avgHotDays: Math.round((m.hotDays / yearsCovered) * 10) / 10,
    }));

    const wettest = [...monthly].sort((a, b) => b.avgRainfallMm - a.avgRainfallMm).slice(0, 3);
    const wettestLabels = wettest.map((m) => m.label).join(", ");

    const summary: string[] = [];
    summary.push(
      `Based on ${yearsCovered} years of historical daily data, ${place.name}${place.admin1 ? ", " + place.admin1 : ""} sees its heaviest rainfall in ${wettestLabels}, averaging ${wettest[0].avgRainyDays} rainy days that month.`
    );
    if (cycloneZone) {
      summary.push(
        "This location sits within the broad tropical cyclone outlook region (Nov–Apr season) — check the current Bureau of Meteorology outlook before firming up programme risk for works scheduled in this window."
      );
    }
    const hottestMonth = [...monthly].sort((a, b) => b.avgHotDays - a.avgHotDays)[0];
    if (hottestMonth.avgHotDays >= 3) {
      summary.push(
        `${hottestMonth.label} averages ${hottestMonth.avgHotDays} days above 35°C — consider heat-affected productivity loss for outdoor trades scheduled then.`
      );
    }

    let suggested: { category: "weather"; description: string; probability: number } | null = null;
    if (programmeMonths.length) {
      const overlapWet = programmeMonths.filter((m) => wettest.some((w) => w.month === m));
      const overlapCyclone = cycloneZone && programmeMonths.some((m) => [11, 12, 1, 2, 3, 4].includes(m));
      if (overlapWet.length || overlapCyclone) {
        const probability = overlapCyclone ? 50 : overlapWet.length >= 2 ? 40 : 25;
        suggested = {
          category: "weather",
          description: `Wet weather delay — programme overlaps ${place.name}'s wettest months (${wettestLabels})${overlapCyclone ? " and the cyclone outlook season" : ""}`,
          probability,
        };
      }
    }

    return NextResponse.json({
      location: { name: place.name, state: place.admin1 || null, country: place.country || null, latitude: place.latitude, longitude: place.longitude },
      cycloneZone,
      yearsCovered,
      monthly,
      summary,
      suggestedRisk: suggested,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unexpected error looking up weather risk." }, { status: 500 });
  }
}
