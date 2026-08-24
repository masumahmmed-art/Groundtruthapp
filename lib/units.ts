// Currency + unit-of-measure helpers so the app isn't Australia/AUD-only.
//
// Design: every rate/quantity keeps whatever unit the estimator originally
// typed (unit stays free text) — nothing here rewrites stored data. This
// module only (a) formats money in the workspace's chosen currency, and
// (b) recognizes common unit strings well enough to show a converted
// equivalent alongside a value when the workspace's preferred system
// (metric/imperial) differs from the unit actually used on that row.

export type UnitSystem = "metric" | "imperial";

export const CURRENCIES: { code: string; label: string; symbol: string }[] = [
  { code: "AUD", label: "Australian Dollar", symbol: "A$" },
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "NZD", label: "New Zealand Dollar", symbol: "NZ$" },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$" },
];

export const REGION_BY_CURRENCY: Record<string, string> = {
  AUD: "Australia",
  USD: "the United States",
  GBP: "the United Kingdom",
  EUR: "the Eurozone",
  NZD: "New Zealand",
  CAD: "Canada",
};

export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol || code;
}

export function formatMoney(value: number, currency: string, maximumFractionDigits = 0): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits }).format(value);
  } catch {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits }).format(value);
  }
}

type Category = "length" | "area" | "volume" | "mass";

interface UnitInfo {
  category: Category;
  system: UnitSystem;
  label: string;
  toBase: number; // value in this unit * toBase = value in the category's SI base unit
}

// SI base units: length -> metre, area -> square metre, volume -> cubic metre, mass -> kilogram.
const UNITS: Record<string, UnitInfo> = {
  m: { category: "length", system: "metric", label: "m", toBase: 1 },
  metre: { category: "length", system: "metric", label: "m", toBase: 1 },
  metres: { category: "length", system: "metric", label: "m", toBase: 1 },
  meter: { category: "length", system: "metric", label: "m", toBase: 1 },
  meters: { category: "length", system: "metric", label: "m", toBase: 1 },
  km: { category: "length", system: "metric", label: "km", toBase: 1000 },
  mm: { category: "length", system: "metric", label: "mm", toBase: 0.001 },
  ft: { category: "length", system: "imperial", label: "ft", toBase: 0.3048 },
  feet: { category: "length", system: "imperial", label: "ft", toBase: 0.3048 },
  foot: { category: "length", system: "imperial", label: "ft", toBase: 0.3048 },
  yd: { category: "length", system: "imperial", label: "yd", toBase: 0.9144 },
  yard: { category: "length", system: "imperial", label: "yd", toBase: 0.9144 },
  mile: { category: "length", system: "imperial", label: "mile", toBase: 1609.344 },

  m2: { category: "area", system: "metric", label: "m²", toBase: 1 },
  "m²": { category: "area", system: "metric", label: "m²", toBase: 1 },
  sqm: { category: "area", system: "metric", label: "m²", toBase: 1 },
  ha: { category: "area", system: "metric", label: "ha", toBase: 10000 },
  sqft: { category: "area", system: "imperial", label: "sq ft", toBase: 0.09290304 },
  "sq ft": { category: "area", system: "imperial", label: "sq ft", toBase: 0.09290304 },
  ft2: { category: "area", system: "imperial", label: "sq ft", toBase: 0.09290304 },
  acre: { category: "area", system: "imperial", label: "acre", toBase: 4046.8564224 },

  m3: { category: "volume", system: "metric", label: "m³", toBase: 1 },
  "m³": { category: "volume", system: "metric", label: "m³", toBase: 1 },
  cum: { category: "volume", system: "metric", label: "m³", toBase: 1 },
  l: { category: "volume", system: "metric", label: "L", toBase: 0.001 },
  litre: { category: "volume", system: "metric", label: "L", toBase: 0.001 },
  litres: { category: "volume", system: "metric", label: "L", toBase: 0.001 },
  "cu yd": { category: "volume", system: "imperial", label: "cu yd", toBase: 0.764554857984 },
  cuyd: { category: "volume", system: "imperial", label: "cu yd", toBase: 0.764554857984 },
  yd3: { category: "volume", system: "imperial", label: "cu yd", toBase: 0.764554857984 },
  gal: { category: "volume", system: "imperial", label: "gal", toBase: 0.00378541 },

  kg: { category: "mass", system: "metric", label: "kg", toBase: 1 },
  tonne: { category: "mass", system: "metric", label: "t", toBase: 1000 },
  tonnes: { category: "mass", system: "metric", label: "t", toBase: 1000 },
  t: { category: "mass", system: "metric", label: "t", toBase: 1000 },
  lb: { category: "mass", system: "imperial", label: "lb", toBase: 0.45359237 },
  lbs: { category: "mass", system: "imperial", label: "lb", toBase: 0.45359237 },
  ton: { category: "mass", system: "imperial", label: "ton", toBase: 907.18474 }, // US short ton
};

// The natural 1:1 counterpart to swap to when the workspace's preferred
// system differs from the unit actually on a row.
const COUNTERPART: Record<Category, { metric: string; imperial: string }> = {
  length: { metric: "m", imperial: "ft" },
  area: { metric: "m2", imperial: "sqft" },
  volume: { metric: "m3", imperial: "cuyd" },
  mass: { metric: "tonne", imperial: "ton" },
};

function normalize(unit: string): string {
  return unit.trim().toLowerCase();
}

export function recognizeUnit(unit: string): UnitInfo | null {
  return UNITS[normalize(unit)] || null;
}

export interface UnitConversion {
  label: string;
  qtyMultiplier: number; // a quantity in the old unit * qtyMultiplier = quantity in the new unit
  rateMultiplier: number; // a rate per old unit * rateMultiplier = rate per new unit
}

/**
 * If `unit` is recognized and its native system differs from
 * `targetSystem`, returns the natural counterpart unit + conversion
 * factors. Returns null for unrecognized units or units already in the
 * target system (nothing to convert / nothing to show).
 */
export function convertedDisplay(unit: string, targetSystem: UnitSystem): UnitConversion | null {
  const info = recognizeUnit(unit);
  if (!info || info.system === targetSystem) return null;

  const counterpartKey = COUNTERPART[info.category][targetSystem];
  const counterpart = UNITS[counterpartKey];
  if (!counterpart) return null;

  const unitsPerOld = info.toBase / counterpart.toBase;

  return {
    label: counterpart.label,
    qtyMultiplier: unitsPerOld,
    rateMultiplier: 1 / unitsPerOld,
  };
}
