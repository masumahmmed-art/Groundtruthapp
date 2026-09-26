"use client";

import { useState } from "react";
import Link from "next/link";
import { login } from "./actions";
import Turnstile from "@/lib/Turnstile";

export default function LoginForm({
  next,
  defaultEmail,
  siteKey,
}: {
  next: string;
  defaultEmail?: string;
  siteKey: string;
}) {
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    let redirectTo: string;
    try {
      ({ redirectTo } = await login(new FormData(e.currentTarget)));
    } catch {
      redirectTo = `/login?error=${encodeURIComponent("Something went wrong — please try again.")}`;
    }
    // A full page load (not client-side navigation) so the new session
    // cookies apply, and so the CAPTCHA widget starts fresh after an error.
    window.location.assign(redirectTo);
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required defaultValue={defaultEmail} autoFocus />
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
      <Turnstile siteKey={siteKey} />
      <button
        type="submit"
        className="btn btn-primary"
        style={{ justifyContent: "center", padding: "10px 13px" }}
        disabled={pending}
      >
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
