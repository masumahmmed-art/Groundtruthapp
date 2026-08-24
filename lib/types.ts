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

export type RateKind = "labour" | "plant" | "material";

export interface RateItemRow {
  id: string;
  org_id: string;
  kind: RateKind;
  name: string;
  unit: string;
  rate: number;
  sort_order: number;
}

export interface Markups {
  preliminaries: number;
  contingency: number;
  overhead: number;
  margin: number;
  /** Client-side administrative cost, shown as a separate line after the contractor's GST-inclusive price — not part of the tender price itself. */
  principalCost: number;
  gst: number;
}

export type RiskCategory = "weather" | "geotechnical" | "programme" | "market" | "safety" | "other";

export interface RiskItemRow {
  id: string;
  project_id: string;
  category: RiskCategory;
  description: string;
  probability: number; // 0-100 (%)
  impact: number; // $ cost if the risk occurs
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
