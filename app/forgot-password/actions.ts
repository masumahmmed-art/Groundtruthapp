"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

function resolveSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const origin = headers().get("origin");
  if (origin) return origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const captchaToken = String(formData.get("cf-turnstile-response") || "") || undefined;
  const origin = resolveSiteUrl();

  const supabase = createClient();

  // Supabase doesn't error here even if the email isn't registered — that's
  // deliberate, so this form can't be used to discover which emails exist.
  // We always show the same "check your email" message regardless. A failed
  // captcha check is a different kind of error (nothing to do with whether
  // the email exists), so that one is still surfaced below.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
    captchaToken,
  });

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent(error.message)}&email=${encodeURIComponent(email)}`);
  }

  redirect(`/forgot-password?sent=1&email=${encodeURIComponent(email)}`);
}
