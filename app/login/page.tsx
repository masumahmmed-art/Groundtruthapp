import Link from "next/link";
import LoginForm from "./LoginForm";

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

        <LoginForm
          next={searchParams.next || "/dashboard"}
          defaultEmail={searchParams.email}
          siteKey={TURNSTILE_SITE_KEY}
        />

        <div className="auth-foot">
          Don&apos;t have a workspace yet? <Link href="/signup">Create one</Link>
        </div>
      </div>
    </div>
  );
}
