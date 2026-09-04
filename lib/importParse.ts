// Parses pasted or uploaded spreadsheet data (tab-separated, as Excel/Google
// Sheets puts on the clipboard when you copy a range, or comma-separated
// .csv) into categories + line items ready to import into a project.
//
// Deliberately generic rather than hard-coded to one file's layout: it looks
// for a header row containing recognisable column names (Description, Unit,
// Quantity, Rate — however they're worded/ordered), then walks the rows
// below it. A row with a description but no usable quantity/rate is treated
// as a section heading (becomes a new category); a row with both is treated
// as a priced line item under whichever heading came before it. This mirrors
// how most agency/government cost-estimate workbooks (and most contractors'
// own BOQs) are laid out — a "SCHEDULE A" / "ZONE 1" style heading row, then
// its priced items underneath.

export interface ParsedLineItem {
  description: string;
  unit: string;
  qty: number;
  rate: number;
}

export interface ParsedCategory {
  name: string;
  items: ParsedLineItem[];
}

export interface ParseResult {
  categories: ParsedCategory[];
  warnings: string[];
  totalItems: number;
}

const HEADER_KEYWORDS: Record<string, string[]> = {
  description: ["description", "desc", "item description", "particulars", "activity"],
  unit: ["unit", "uom", "unit of measure", "units"],
  qty: ["qty", "quantity", "qnty"],
  rate: ["unit rate", "rate", "unit price", "price"],
};

function normalizeCell(cell: string): string {
  return cell.trim().toLowerCase();
}

/** Splits one line on a delimiter, respecting "quoted, fields" that may contain the delimiter. */
function splitDelimited(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

function detectDelimiter(text: string): string {
  const sampleLines = text.split("\n").slice(0, 20);
  const tabCount = sampleLines.reduce((s, l) => s + (l.match(/\t/g)?.length || 0), 0);
  const commaCount = sampleLines.reduce((s, l) => s + (l.match(/,/g)?.length || 0), 0);
  return tabCount >= commaCount ? "\t" : ",";
}

/** Parses a cell like "$1,234.50", "70,884", "(500)" into a number, or 0 if it isn't one. */
function parseNumberCell(cell: string): number {
  const trimmed = cell.trim();
  if (!trimmed) return 0;
  const negative = /^\(.*\)$/.test(trimmed);
  const cleaned = trimmed.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  if (isNaN(n)) return 0;
  return negative ? -Math.abs(n) : n;
}

interface ColumnMap {
  description: number;
  unit: number;
  qty: number;
  rate: number;
}

/** Scores how header-like a row of cells is, and (if good enough) returns the detected column positions. */
function tryDetectHeader(cells: string[]): ColumnMap | null {
  const map: Partial<ColumnMap> = {};
  let score = 0;
  cells.forEach((raw, idx) => {
    const cell = normalizeCell(raw);
    if (!cell) return;
    for (const [field, keywords] of Object.entries(HEADER_KEYWORDS)) {
      if (map[field as keyof ColumnMap] !== undefined) continue;
      if (keywords.some((kw) => cell === kw || cell.includes(kw))) {
        map[field as keyof ColumnMap] = idx;
        score++;
        break;
      }
    }
  });
  // Require at least "description" plus one of unit/qty/rate to call this a header row.
  if (map.description === undefined) return null;
  if (score < 2) return null;
  return {
    description: map.description,
    unit: map.unit ?? -1,
    qty: map.qty ?? -1,
    rate: map.rate ?? -1,
  };
}

export function parseSpreadsheetText(text: string): ParseResult {
  const warnings: string[] = [];
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (!lines.length) {
    return { categories: [], warnings: ["Nothing to parse — paste some rows first."], totalItems: 0 };
  }

  const delimiter = detectDelimiter(lines.slice(0, 20).join("\n"));

  let headerIdx = -1;
  let columns: ColumnMap | null = null;
  const scanLimit = Math.min(lines.length, 15);
  for (let i = 0; i < scanLimit; i++) {
    const cells = splitDelimited(lines[i], delimiter);
    const detected = tryDetectHeader(cells);
    if (detected) {
      headerIdx = i;
      columns = detected;
      break;
    }
  }

  if (!columns) {
    // Fall back to a best-guess column order so a plain, header-less paste
    // (Description, Unit, Quantity, Rate) still works.
    columns = { description: 0, unit: 1, qty: 2, rate: 3 };
    headerIdx = -1;
    warnings.push(
      "Couldn't find column headings (Description / Unit / Quantity / Rate) — guessed the first four columns are Description, Unit, Quantity, Rate in that order. Check the preview below carefully."
    );
  }

  const categories: ParsedCategory[] = [];
  let current: ParsedCategory | null = null;
  let totalItems = 0;
  let skippedRows = 0;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = splitDelimited(lines[i], delimiter);
    const description = (cells[columns.description] || "").trim();
    if (!description) {
      skippedRows++;
      continue;
    }

    const unit = columns.unit >= 0 ? (cells[columns.unit] || "").trim() : "";
    const qty = columns.qty >= 0 ? parseNumberCell(cells[columns.qty] || "") : 0;
    const rate = columns.rate >= 0 ? parseNumberCell(cells[columns.rate] || "") : 0;

    const looksLikeLineItem = qty !== 0 || rate !== 0;

    if (!looksLikeLineItem) {
      // Treat as a section heading — starts a new category.
      current = { name: description, items: [] };
      categories.push(current);
      continue;
    }

    if (!current) {
      current = { name: "Imported items", items: [] };
      categories.push(current);
    }

    current.items.push({ description, unit: unit || "unit", qty, rate });
    totalItems++;
  }

  if (skippedRows > 0) {
    warnings.push(`${skippedRows} blank row${skippedRows === 1 ? "" : "s"} skipped.`);
  }
  if (totalItems === 0) {
    warnings.push("No priced line items were found — check that Quantity and Rate columns have numbers in them.");
  }

  return { categories, warnings, totalItems };
}
