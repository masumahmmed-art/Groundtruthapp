import Link from "next/link";
import { requestPasswordReset } from "./actions";

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: { sent?: string; email?: string; error?: string };
}) {
  if (searchParams.sent) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="mark">GT</div>
          <h1>Check your email</h1>
          <p className="lead">
            If <strong>{searchParams.email}</strong> has a Ground Truth Estimator account,
            we&apos;ve sent a link to reset the password. Click it to choose a new one.
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
        <h1>Reset your password</h1>
        <p className="lead">
          Enter the email on your account and we&apos;ll send a link to set a new password.
        </p>

        {searchParams.error && (
          <div className="auth-error" style={{ marginBottom: 14 }}>
            {searchParams.error}
          </div>
        )}

        <form className="auth-form" action={requestPasswordReset}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoFocus />
          </div>
          <button type="submit" className="btn btn-primary" style={{ justifyContent: "center", padding: "10px 13px" }}>
            Send reset link
          </button>
        </form>

        <div className="auth-foot">
          Remembered it? <Link href="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}
