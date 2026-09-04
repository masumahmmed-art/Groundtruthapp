// Hand-written types matching supabase/schema.sql.
// (If you prefer generated types: `npx supabase gen types typescript --project-id <ref> > lib/types.ts`
// — just re-add the domain types below the generated Database type if you do.)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type RateKind = "labour" | "plant" | "material" | "subcontract";

export interface RateItemRow {
  id: string;
  org_id: string;
  kind: RateKind;
  name: string;
  unit: string;
  rate: number;
  sort_order: number;
}

export type PreliminaryCategory =
  | "site_management"
  | "site_facilities"
  | "temporary_services"
  | "security"
  | "temporary_works"
  | "quality_safety_environmental"
  | "cleaning_waste"
  | "insurances"
  | "bonds_guarantees"
  | "permits_approvals"
  | "mobilisation"
  | "other";

/**
 * One line item in an itemised preliminaries / indirect-cost build-up
 * (called "General Conditions" in the US). Follows the standard QS
 * distinction (RICS NRM2, NZES) between a "fixed" one-off cost and a
 * "time_related" cost that scales with however long the job runs —
 * e.g. a site supervisor's $/week rate times the estimated project
 * duration, rather than a single lump sum.
 */
export interface PreliminaryItem {
  id: string;
  category: PreliminaryCategory;
  description: string;
  type: "fixed" | "time_related";
  /** Dollar amount: a one-off total if type is "fixed", or a $/week rate if type is "time_related". */
  rate: number;
  notes?: string;
}

/**
 * Client-side ("Principal's") cost categories — the client's own
 * administration of the job, as distinct from the contractor's preliminaries
 * above. Modelled on a typical government/agency client cost estimate: staff
 * time running the project, plus one-off studies/investigations/approvals.
 */
export type ClientCostCategory =
  | "project_management"
  | "design_investigation"
  | "environmental_approvals"
  | "property_acquisition"
  | "contract_administration"
  | "other";

/**
 * One line item in an itemised client-cost build-up — same fixed/time-related
 * shape as PreliminaryItem, just scoped to the client's own admin categories
 * instead of the contractor's site preliminaries.
 */
export interface ClientCostItem {
  id: string;
  category: ClientCostCategory;
  description: string;
  type: "fixed" | "time_related";
  /** Dollar amount: a one-off total if type is "fixed", or a $/week rate if type is "time_related". */
  rate: number;
  notes?: string;
}

export interface Markups {
  /** Legacy/default path: preliminaries as a flat % of direct cost. Still used when preliminariesMode is "percent" or unset. */
  preliminaries: number;
  /** "percent" (default, backward compatible) or "buildup" (itemised, see preliminariesItems). */
  preliminariesMode?: "percent" | "buildup";
  /** Itemised preliminaries lines, used only when preliminariesMode is "buildup". */
  preliminariesItems?: PreliminaryItem[];
  /** Estimated project duration in weeks — multiplies every "time_related" preliminaries item. Used only in buildup mode. */
  projectDurationWeeks?: number;
  contingency: number;
  overhead: number;
  margin: number;
  /** Client-side administrative cost, shown as a separate line after the contractor's GST-inclusive price — not part of the tender price itself. */
  principalCost: number;
  /** "percent" (default, backward compatible, flat % of contract price) or "buildup" (itemised, see principalCostItems). */
  principalCostMode?: "percent" | "buildup";
  /** Itemised client-cost lines, used only when principalCostMode is "buildup". */
  principalCostItems?: ClientCostItem[];
  /** Duration in weeks used by "time_related" client-cost items. Kept separate from projectDurationWeeks because the client's own administration typically spans more than just the construction period (concept, design, delivery, finalisation). Defaults to projectDurationWeeks if unset. */
  clientCostDurationWeeks?: number;
  gst: number;
  /** Number of months the total project cost is spread over in the Cash Flow section, starting from the project date. */
  cashFlowMonths?: number;
}

export type RiskCategory = "weather" | "geotechnical" | "flood" | "seismic" | "programme" | "market" | "safety" | "other";

export interface RiskItemRow {
  id: string;
  project_id: string;
  category: RiskCategory;
  description: string;
  probability: number; // 0-100 (%)
  impact: number; // $ cost if the risk occurs — the "most likely" figure when a min/max range is also set
  /** Optional 3-point estimate: minimum plausible cost impact, if this risk occurs. Null = no range set, `impact` is used as a single fixed figure. */
  impact_min?: number | null;
  /** Optional 3-point estimate: maximum plausible cost impact, if this risk occurs. Null = no range set, `impact` is used as a single fixed figure. */
  impact_max?: number | null;
  notes: string;
  sort_order: number;
}

export interface BuildupComponent {
  ref: string; // rate_items.id
  perUnit: number;
}

export interface ProjectRow {
  id: string;
  org_id: string;
  name: string;
  client: string;
  location: string;
  prepared_by: string;
  project_date: string;
  notes: string;
  markups: Markups;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  project_id: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface LineItemRow {
  id: string;
  category_id: string;
  description: string;
  unit: string;
  qty: number;
  labour: BuildupComponent[];
  plant: BuildupComponent[];
  material: BuildupComponent[];
  subcontract: BuildupComponent[];
  /** "buildup" (default, backward compatible — rate comes from labour/plant/material/subcontract) or "flat" (rate comes from flat_rate directly). */
  rate_mode?: "buildup" | "flat";
  /** Used only when rate_mode is "flat" — the unit rate, typed directly or set by the spreadsheet importer. */
  flat_rate?: number;
  sort_order: number;
}

export interface OrganizationRow {
  id: string;
  name: string;
  currency: string;
  unit_system: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: OrganizationRow;
        Insert: Partial<OrganizationRow> & { name?: string };
        Update: Partial<OrganizationRow>;
      };
      org_members: {
        Row: { org_id: string; user_id: string; role: string; created_at: string };
        Insert: { org_id: string; user_id: string; role?: string };
        Update: { role?: string };
      };
      rate_items: {
        Row: RateItemRow;
        Insert: Partial<RateItemRow> & { org_id: string; kind: RateKind; name: string; unit: string; rate: number };
        Update: Partial<RateItemRow>;
      };
      projects: {
        Row: ProjectRow;
        Insert: Partial<ProjectRow> & { org_id: string };
        Update: Partial<ProjectRow>;
      };
      categories: {
        Row: CategoryRow;
        Insert: Partial<CategoryRow> & { project_id: string; name: string };
        Update: Partial<CategoryRow>;
      };
      line_items: {
        Row: LineItemRow;
        Insert: Partial<LineItemRow> & { category_id: string };
        Update: Partial<LineItemRow>;
      };
      risk_items: {
        Row: RiskItemRow;
        Insert: Partial<RiskItemRow> & { project_id: string };
        Update: Partial<RiskItemRow>;
      };
    };
  };
}
