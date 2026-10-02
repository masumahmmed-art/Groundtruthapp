import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { acceptInvitation, signOutForInvite } from "./actions";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // middleware.ts already sends logged-out visitors to /login?next=/invite/<token>
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${params.token}`)}`);

  const validToken = /^[0-9a-f-]{36}$/i.test(params.token);
  const { data } = validToken
    ? await supabase.rpc("invitation_details", { p_token: params.token })
    : { data: null };
  const invite = Array.isArray(data) ? data[0] : null;
  const wrongAccount = invite && invite.email.toLowerCase() !== (user.email || "").toLowerCase();

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="mark">GT</div>

        {!invite ? (
          <>
            <h1>Invitation not found</h1>
            <p className="lead">This link isn&apos;t valid. Ask the person who invited you to send a new one.</p>
          </>
        ) : invite.accepted ? (
          <>
            <h1>Already used</h1>
            <p className="lead">This invitation has already been accepted.</p>
            <a className="btn btn-primary" href="/dashboard" style={{ width: "100%", justifyContent: "center" }}>
              Go to your workspace
            </a>
          </>
        ) : invite.expired ? (
          <>
            <h1>Invitation expired</h1>
            <p className="lead">Invitations last 14 days. Ask {invite.invited_by_email || "the workspace owner"} to send a new one.</p>
          </>
        ) : wrongAccount ? (
          <>
            <h1>Different email address</h1>
            <p className="lead">
              This invitation is for <strong>{invite.email}</strong>, but you&apos;re logged in as{" "}
              <strong>{user.email}</strong>. Log out, then log in or sign up with {invite.email}.
            </p>
            <form action={signOutForInvite}>
              <input type="hidden" name="token" value={params.token} />
              <button className="btn btn-primary" type="submit" style={{ width: "100%", justifyContent: "center" }}>
                Log out and continue
              </button>
            </form>
          </>
        ) : (
          <>
            <h1>Join {invite.org_name}</h1>
            <p className="lead">
              {invite.invited_by_email || "The workspace owner"} has invited you to join <strong>{invite.org_name}</strong> on
              Ground Truth Estimator.
            </p>
            {searchParams.error && <div className="auth-error" style={{ marginBottom: 14 }}>{searchParams.error}</div>}
            <p className="hint" style={{ marginBottom: 14 }}>
              Joining moves you out of the empty workspace created when you signed up. If you&apos;ve already started
              projects in your own workspace, you&apos;ll be told before anything changes.
            </p>
            <form action={acceptInvitation}>
              <input type="hidden" name="token" value={params.token} />
              <button className="btn btn-primary" type="submit" style={{ width: "100%", justifyContent: "center" }}>
                Join {invite.org_name}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
