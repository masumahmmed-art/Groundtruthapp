"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { InvoiceApprovalMode, OrgInvitationRow, OrganizationRow, TeamMember } from "@/lib/types";
import { useOrgSettings } from "@/lib/OrgSettingsContext";
import { formatMoney } from "@/lib/units";

function inviteLink(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

function parseLimit(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const n = parseFloat(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function TeamSettings({
  org,
  currentUserId,
  isOwner,
  initialTeam,
  initialInvites,
}: {
  org: OrganizationRow;
  currentUserId: string;
  isOwner: boolean;
  initialTeam: TeamMember[];
  initialInvites: OrgInvitationRow[];
}) {
  const supabase = createClient();
  const { currency } = useOrgSettings();
  const [mode, setMode] = useState<InvoiceApprovalMode>(org.invoice_approval_mode || "simple");
  const [team, setTeam] = useState<TeamMember[]>(initialTeam);
  const [invites, setInvites] = useState<OrgInvitationRow[]>(initialInvites);
  const [email, setEmail] = useState("");
  const [limit, setLimit] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function changeMode(next: InvoiceApprovalMode) {
    const prev = mode;
    setMode(next);
    const { error } = await supabase.from("organizations").update({ invoice_approval_mode: next }).eq("id", org.id);
    if (error) {
      setMode(prev);
      setMessage(error.message);
    } else {
      setMessage(next === "two_step" ? "Two-step approval is on." : "Simple approval is on.");
    }
  }

  async function saveLimit(member: TeamMember, value: string) {
    const lim = parseLimit(value);
    const { error } = await supabase.rpc("set_member_approval_limit", {
      p_org_id: org.id,
      p_user_id: member.user_id,
      p_limit: lim,
    });
    if (error) setMessage(error.message);
    else setTeam((prev) => prev.map((m) => (m.user_id === member.user_id ? { ...m, approval_limit: lim } : m)));
  }

  async function removeMember(member: TeamMember) {
    if (!confirm(`Remove ${member.email} from this workspace? They lose access straight away. Their past approvals stay on record.`)) return;
    const { error } = await supabase.rpc("remove_member", { p_org_id: org.id, p_user_id: member.user_id });
    if (error) setMessage(error.message);
    else setTeam((prev) => prev.filter((m) => m.user_id !== member.user_id));
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const addr = email.trim().toLowerCase();
    if (!addr.includes("@")) {
      setMessage("Enter the person's email address.");
      return;
    }
    if (team.some((m) => m.email.toLowerCase() === addr)) {
      setMessage(`${addr} is already in your team.`);
      return;
    }
    const { data, error } = await supabase
      .from("org_invitations")
      .insert({ org_id: org.id, email: addr, approval_limit: parseLimit(limit) })
      .select("*")
      .single();
    if (error || !data) {
      setMessage(
        error?.message.includes("duplicate") ? `There's already an open invitation for ${addr}.` : error?.message || "Couldn't create the invitation."
      );
      return;
    }
    setInvites((prev) => [data as OrgInvitationRow, ...prev]);
    setEmail("");
    setLimit("");
    await copy((data as OrgInvitationRow).token);
    setMessage(`Invitation created for ${addr}. The link is copied — send it to them by email or message. It works for 14 days.`);
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(token));
      setCopied(token);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      window.prompt("Copy this invitation link:", inviteLink(token));
    }
  }

  async function revoke(inv: OrgInvitationRow) {
    if (!confirm(`Cancel the invitation for ${inv.email}? The link stops working.`)) return;
    setInvites((prev) => prev.filter((i) => i.id !== inv.id));
    await supabase.from("org_invitations").delete().eq("id", inv.id);
  }

  return (
    <div style={{ marginTop: 32 }}>
      <div className="section">
        <div className="section-head">
          <h3>Team &amp; invoice approvals</h3>
          {!isOwner && <span className="hint">Only the workspace owner can change these.</span>}
        </div>

        {message && (
          <div className="note">
            <span>ℹ</span>
            <span>{message}</span>
          </div>
        )}

        <div className="card" style={{ padding: "18px 22px", marginBottom: 16, maxWidth: 760 }}>
          <div className="field">
            <label>How supplier invoices are approved</label>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontWeight: 400, marginTop: 8 }}>
              <input type="radio" name="approval_mode" disabled={!isOwner} checked={mode === "simple"} onChange={() => changeMode("simple")} />
              <span>
                <b>Simple</b> — anyone in the team reviews an invoice and approves it in one step. Suits a small team.
              </span>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontWeight: 400, marginTop: 8 }}>
              <input type="radio" name="approval_mode" disabled={!isOwner} checked={mode === "two_step"} onChange={() => changeMode("two_step")} />
              <span>
                <b>Two-step</b> — whoever prepares an invoice submits it; the project manager confirms the goods or work
                were received; then someone whose approval limit covers the total approves it. A project manager whose
                own limit covers the invoice approves it in the same click. Nobody can approve an invoice they submitted.
              </span>
            </label>
          </div>
        </div>

        <div className="card rate-table-wrap" style={{ marginBottom: 16, maxWidth: 760 }}>
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th style={{ width: 90 }}>Role</th>
                <th className="num" style={{ width: 190 }}>Approval limit (incl. GST)</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.user_id}>
                  <td>
                    {m.email}
                    {m.user_id === currentUserId && <span className="hint"> (you)</span>}
                  </td>
                  <td>{m.role === "owner" ? "Owner" : "Member"}</td>
                  <td className="num">
                    {m.role === "owner" ? (
                      <span className="hint">No limit</span>
                    ) : isOwner ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        className="mono"
                        placeholder="Can't approve"
                        defaultValue={m.approval_limit ?? ""}
                        onBlur={(e) => saveLimit(m, e.target.value)}
                      />
                    ) : m.approval_limit === null ? (
                      <span className="hint">Can&apos;t approve</span>
                    ) : (
                      <span className="mono">{formatMoney(m.approval_limit, currency)}</span>
                    )}
                  </td>
                  <td>
                    {isOwner && m.role !== "owner" && (
                      <button className="btn btn-ghost btn-sm btn-danger" title="Remove from workspace" onClick={() => removeMember(m)}>
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isOwner && (
          <div className="card" style={{ padding: "18px 22px", maxWidth: 760 }}>
            <form onSubmit={invite} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className="field" style={{ flex: "1 1 240px" }}>
                <label>Invite someone by email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com.au" />
              </div>
              <div className="field" style={{ flex: "0 1 180px" }}>
                <label>Approval limit (optional)</label>
                <input type="text" inputMode="decimal" className="mono" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="e.g. 10000" />
              </div>
              <button className="btn btn-primary" type="submit">
                Create invite link
              </button>
            </form>
            <div className="hint" style={{ marginTop: 8 }}>
              You&apos;ll get a link to send them. They sign up or log in with that email address and join this
              workspace. Leave the limit blank for someone who prepares or checks invoices but doesn&apos;t give final
              approval.
            </div>

            {invites.length > 0 && (
              <table style={{ marginTop: 14 }}>
                <thead>
                  <tr>
                    <th>Waiting to join</th>
                    <th className="num" style={{ width: 150 }}>Limit</th>
                    <th style={{ width: 120 }}>Expires</th>
                    <th style={{ width: 150 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((inv) => {
                    const expired = new Date(inv.expires_at) < new Date();
                    return (
                      <tr key={inv.id}>
                        <td>{inv.email}</td>
                        <td className="num mono">{inv.approval_limit === null ? "—" : formatMoney(inv.approval_limit, currency)}</td>
                        <td style={{ color: expired ? "var(--danger)" : undefined }}>
                          {expired ? "Expired" : new Date(inv.expires_at).toLocaleDateString()}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {!expired && (
                            <button className="btn btn-sm" type="button" onClick={() => copy(inv.token)}>
                              {copied === inv.token ? "Copied" : "Copy link"}
                            </button>
                          )}
                          <button className="btn btn-ghost btn-sm btn-danger" type="button" title="Cancel invitation" onClick={() => revoke(inv)}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
