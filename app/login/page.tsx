import Link from "next/link";
import { login } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; email?: string; next?: string };
}) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="mark">GT</div>
        <h1>Welcome back</h1>
        <p className="lead">Log in to your Ground Truth Estimator workspace.</p>

        {searchParams.error && <div className="auth-error" style={{ marginBottom: 14 }}>{searchParams.error}</div>}

        <form className="auth-form" action={login}>
          <input type="hidden" name="next" value={searchParams.next || "/dashboard"} />
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required defaultValue={searchParams.email} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required minLength={6} />
          </div>
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
