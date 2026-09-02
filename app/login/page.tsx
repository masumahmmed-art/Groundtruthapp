import Link from "next/link";
import { login } from "./actions";
import Turnstile from "@/lib/Turnstile";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; email?: string; next?: string; reset?: string };
}) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="mark">GT</div>
        <h1>Welcome back</h1>
        <p className="lead">Log in to your Ground Truth Estimator workspace.</p>

        {searchParams.reset && (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 13px",
              borderRadius: 8,
              background: "rgba(31,111,160,0.08)",
              border: "1px solid var(--blueprint)",
              color: "var(--blueprint)",
              fontSize: 14,
            }}
          >
            Password updated — log in with your new password.
          </div>
        )}

        {searchParams.error && <div className="auth-error" style={{ marginBottom: 14 }}>{searchParams.error}</div>}

        <form className="auth-form" action={login}>
          <input type="hidden" name="next" value={searchParams.next || "/dashboard"} />
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required defaultValue={searchParams.email} autoFocus />
          </div>
          <div className="field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <label htmlFor="password">Password</label>
              <Link href="/forgot-password" style={{ fontSize: 13 }}>
                Forgot password?
              </Link>
            </div>
            <input id="password" name="password" type="password" required minLength={6} />
          </div>
          <Turnstile siteKey={TURNSTILE_SITE_KEY} />
          <button type="submit" className="btn btn-primary" style={{ justifyContent: "center", padding: "10px 13px" }}>
            Log in
          </button>
        </form>

        <div className="auth-foot">
          Don&apos;t have a workspace yet? <Link href="/signup">Create one</Link>
        </div>
      </div>
    </div>
  );
}
