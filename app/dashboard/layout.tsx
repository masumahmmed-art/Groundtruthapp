import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import RailNav from "./RailNav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, organizations(name)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const orgName = (membership as any)?.organizations?.name || "My Company";

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
      <main className="content">{children}</main>
    </div>
  );
}
