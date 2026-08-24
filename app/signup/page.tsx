import Link from "next/link";
import { signup } from "./actions";

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string; email?: string; "check-email"?: string; "already-registered"?: string };
}) {
  if (searchParams["already-registered"]) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="mark">GT</div>
          <h1>You already have an account</h1>
          <p className="lead">
            <strong>{searchParams.email}</strong> is already registered. Log in instead — if
            you've forgotten your password, let us know and we'll help you reset it.
          </p>
          <Link href={`/login?email=${encodeURIComponent(searchParams.email || "")}`} className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
            Go to log in
          </Link>
        </div>
      </div>
    );
  }

  if (searchParams["check-email"]) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="mark">GT</div>
          <h1>Check your email</h1>
          <p className="lead">
            We sent a confirmation link to <strong>{searchParams.email}</strong>. Click it to
            activate your workspace, then come back and log in.
          </p>
          <Link href="/login" className="btn" style={{ width: "100%", justifyContent: "center" }}>
            Back to log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="mark">GT</div>
        <h1>Create your workspace</h1>
        <p className="lead">
          One account per company — you&apos;ll get your own rate library and projects, invisible
          to everyone else.
        </p>

        {searchParams.error && <div className="auth-error" style={{ marginBottom: 14 }}>{searchParams.error}</div>}

        <form className="auth-form" action={signup}>
          <div className="field">
            <label htmlFor="email">Work email</label>
            <input id="email" name="email" type="email" required defaultValue={searchParams.email} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required minLength={6} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ justifyContent: "center", padding: "10px 13px" }}>
            Create workspace
          </button>
        </form>

        <div className="auth-foot">
          Already have an account? <Link href="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}
