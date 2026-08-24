"use client";

import { createContext, useContext } from "react";
import type { UnitSystem } from "@/lib/units";

export interface OrgSettings {
  currency: string;
  unitSystem: UnitSystem;
}

const DEFAULTS: OrgSettings = { currency: "AUD", unitSystem: "metric" };

const OrgSettingsContext = createContext<OrgSettings>(DEFAULTS);

export function OrgSettingsProvider({ value, children }: { value: OrgSettings; children: React.ReactNode }) {
  return <OrgSettingsContext.Provider value={value}>{children}</OrgSettingsContext.Provider>;
}

export function useOrgSettings(): OrgSettings {
  return useContext(OrgSettingsContext);
}
