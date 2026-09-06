// Parses a Primavera P6 ".xer" schedule export. XER is plain tab-delimited
// text (not a binary or P6-only encoding) — every table starts with a %T
// row naming it, a %F row naming its columns, then one %R row per record,
// until the next %T or the file's closing %E. No library needed to read it.
//
// This reads just the two tables needed to build this app's Programme:
//   PROJWBS — the WBS hierarchy, for each node's name (wbs_name)
//   TASK    — each activity: which WBS it sits under (wbs_id), its current
//             planned dates (target_start_date / target_end_date — these
//             are what move each time the schedule is re-baselined, which
//             is exactly what a monthly re-import is meant to pick up), and
//             its progress (phys_complete_pct).
//
// Activities are rolled up to their WBS node (earliest target_start_date /
// latest target_end_date among that node's activities) since a WBS node is
// the natural match for this app's Categories — importing every individual
// activity would usually be far more granular than the BOQ categories
// already set up on a project.

export interface XerWbsNode {
  wbsId: string;
  name: string;
  /** "YYYY-MM-DD" — earliest target_start_date across this node's activities, or null if none had a usable date. */
  plannedStart: string | null;
  /** "YYYY-MM-DD" — latest target_end_date across this node's activities, or null if none had a usable date. */
  plannedEnd: string | null;
  taskCount: number;
  /** 0-100, a simple average across this node's activities — as reported in the file, shown for reference only (not yet used for Earned Value — see the Actual Cost capture phase for that). */
  avgPctComplete: number;
}

export interface XerParseResult {
  nodes: XerWbsNode[];
  warnings: string[];
}

interface XerTable {
  name: string;
  fields: string[];
  rows: string[][];
}

function parseXerTables(text: string): XerTable[] {
  const lines = text.split(/\r?\n/);
  const tables: XerTable[] = [];
  let current: XerTable | null = null;

  for (const line of lines) {
    if (!line) continue;
    const cells = line.split("\t");
    const marker = cells[0];
    if (marker === "%T") {
      current = { name: (cells[1] || "").trim(), fields: [], rows: [] };
      tables.push(current);
    } else if (marker === "%F" && current) {
      current.fields = cells.slice(1);
    } else if (marker === "%R" && current) {
      current.rows.push(cells.slice(1));
    }
    // %E (end of file) and anything else is ignored.
  }
  return tables;
}

function rowsAsObjects(table: XerTable | undefined): Record<string, string>[] {
  if (!table) return [];
  return table.rows.map((row) => {
    const obj: Record<string, string> = {};
    table.fields.forEach((f, i) => {
      obj[f] = row[i] ?? "";
    });
    return obj;
  });
}

/** XER's datetime format is e.g. "2024-01-15 00:00" — this takes just the date part, or null if blank/unparseable. */
function xerDateToIso(raw: string | undefined): string | null {
  if (!raw) return null;
  const datePart = raw.trim().split(" ")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
}

export function parseXer(text: string): XerParseResult {
  const warnings: string[] = [];

  if (!text.includes("%T") || !/ERMHDR/.test(text.slice(0, 200))) {
    warnings.push("This doesn't look like a Primavera .xer file (no ERMHDR header found) — double-check the export before continuing.");
  }

  const tables = parseXerTables(text);
  const wbsTable = tables.find((t) => t.name === "PROJWBS");
  const taskTable = tables.find((t) => t.name === "TASK");

  if (!taskTable) {
    return {
      nodes: [],
      warnings: [...warnings, "Couldn't find a TASK table in this file — is it a full Primavera .xer schedule export?"],
    };
  }

  const wbsNameById = new Map<string, string>();
  rowsAsObjects(wbsTable).forEach((r) => {
    if (r.wbs_id) wbsNameById.set(r.wbs_id, r.wbs_name || r.wbs_short_name || r.wbs_id);
  });

  const byWbs = new Map<string, { starts: string[]; ends: string[]; pcts: number[] }>();
  for (const t of rowsAsObjects(taskTable)) {
    const wbsId = t.wbs_id || "";
    if (!wbsId) continue;
    const bucket = byWbs.get(wbsId) || { starts: [], ends: [], pcts: [] };
    const start = xerDateToIso(t.target_start_date);
    const end = xerDateToIso(t.target_end_date);
    if (start) bucket.starts.push(start);
    if (end) bucket.ends.push(end);
    const pctRaw = parseFloat(t.phys_complete_pct || "0");
    // Some P6 configurations store this as a 0-1 fraction rather than 0-100.
    bucket.pcts.push(isNaN(pctRaw) ? 0 : pctRaw <= 1 ? pctRaw * 100 : pctRaw);
    byWbs.set(wbsId, bucket);
  }

  const nodes: XerWbsNode[] = [];
  byWbs.forEach((bucket, wbsId) => {
    nodes.push({
      wbsId,
      name: wbsNameById.get(wbsId) || wbsId,
      plannedStart: bucket.starts.length ? bucket.starts.slice().sort()[0] : null,
      plannedEnd: bucket.ends.length ? bucket.ends.slice().sort().slice(-1)[0] : null,
      taskCount: bucket.pcts.length,
      avgPctComplete: bucket.pcts.length ? bucket.pcts.reduce((s, v) => s + v, 0) / bucket.pcts.length : 0,
    });
  });
  nodes.sort((a, b) => (a.plannedStart || "").localeCompare(b.plannedStart || ""));

  if (!nodes.length) {
    warnings.push("No activities with a WBS assignment were found — nothing to import.");
  } else {
    const missingDates = nodes.filter((n) => !n.plannedStart || !n.plannedEnd).length;
    if (missingDates > 0) {
      warnings.push(
        `${missingDates} WBS node${missingDates === 1 ? "" : "s"} had no usable dates on ${missingDates === 1 ? "its" : "their"} activities and will show as unscheduled.`
      );
    }
  }

  return { nodes, warnings };
}
