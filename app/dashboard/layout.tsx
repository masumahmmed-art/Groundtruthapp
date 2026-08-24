import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import RailNav from "./RailNav";
import { OrgSettingsProvider } from "@/lib/OrgSettingsContext";
import type { UnitSystem } from "@/lib/units";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, organizations(name, currency, unit_system)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const org = (membership as any)?.organizations;
  const orgName = org?.name || "My Company";
  const currency = org?.currency || "AUD";
  const unitSystem = (org?.unit_system || "metric") as UnitSystem;

  return (
    <div id="app">
      <nav className="rail">
        <div className="rail-brand">
          <div className="mark">GT</div>
          <h1>Ground Truth</h1>
          <div className="tagline">{orgName}</div>
        </div>
        <RailNav />
        <div className="rail-totals">
          <div className="label">Signed in as</div>
          <div className="sub" style={{ marginTop: 6, wordBreak: "break-all", color: "var(--rail-text)" }}>
            {user.email}
          </div>
          <form action={signOut} style={{ marginTop: 12 }}>
            <button type="submit" className="btn btn-sm" style={{ width: "100%", justifyContent: "center" }}>
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <main className="content">
        <OrgSettingsProvider value={{ currency, unitSystem }}>{children}</OrgSettingsProvider>
      </main>
    </div>
  );
}
