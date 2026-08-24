import { updatePassword } from "./actions";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="mark">GT</div>
        <h1>Choose a new password</h1>
        <p className="lead">Set a new password for your Ground Truth Estimator account.</p>

        {searchParams.error && <div className="auth-error" style={{ marginBottom: 14 }}>{searchParams.error}</div>}

        <form className="auth-form" action={updatePassword}>
          <div className="field">
            <label htmlFor="password">New password</label>
            <input id="password" name="password" type="password" required minLength={6} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirm new password</label>
            <input id="confirm" name="confirm" type="password" required minLength={6} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ justifyContent: "center", padding: "10px 13px" }}>
            Update password
          </button>
        </form>
      </div>
    </div>
  );
}
