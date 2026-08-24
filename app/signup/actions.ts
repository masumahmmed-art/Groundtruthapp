"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

// Prefer an explicit site URL (set NEXT_PUBLIC_SITE_URL in Vercel's env vars
// to your real domain). Falls back to the request's Origin header, which
// works locally but isn't reliably present on every hosting setup — hence
// the explicit override option.
function resolveSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const origin = headers().get("origin");
  if (origin) return origin;
  // Vercel sets this automatically on every deployment as a last resort.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const origin = resolveSiteUrl();

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}&email=${encodeURIComponent(email)}`);
  }

  // Supabase returns a "success" response even when the email is already
  // registered (it never throws an error here, to avoid letting the signup
  // form be used to discover which emails exist). The documented way to
  // detect that case is: data.user exists but data.user.identities is an
  // empty array. When that happens, send the visitor to log in instead of
  // showing a misleading "check your email" screen.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    redirect(`/signup?already-registered=1&email=${encodeURIComponent(email)}`);
  }

  // If your Supabase project has "Confirm email" turned on (the default),
  // there is no session yet — send the user to check their inbox instead
  // of straight to the dashboard.
  if (data.user && !data.session) {
    redirect(`/signup?check-email=1&email=${encodeURIComponent(email)}`);
  }

  redirect("/dashboard");
}
