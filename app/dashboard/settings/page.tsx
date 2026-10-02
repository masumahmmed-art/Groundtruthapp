import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrgInvitationRow, OrganizationRow, TeamMember } from "@/lib/types";
import SettingsClient from "./SettingsClient";
import TeamSettings from "./TeamSettings";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { saved?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("role, organizations(id, name, currency, unit_system, created_at, invoice_approval_mode)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const org = (membership as any)?.organizations as OrganizationRow | undefined;
  if (!org) {
    return <div className="empty">No workspace found for this account.</div>;
  }
  const isOwner = (membership as any)?.role === "owner";

  const [{ data: team }, { data: invites }] = await Promise.all([
    supabase.rpc("org_member_list", { p_org_id: org.id }),
    isOwner
      ? supabase
          .from("org_invitations")
          .select("*")
          .eq("org_id", org.id)
          .is("accepted_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as OrgInvitationRow[] }),
  ]);

  return (
    <div>
      <SettingsClient org={org} saved={!!searchParams.saved} />
      <TeamSettings
        org={org}
        currentUserId={user.id}
        isOwner={isOwner}
        initialTeam={(team || []) as TeamMember[]}
        initialInvites={(invites || []) as OrgInvitationRow[]}
      />
    </div>
  );
}
