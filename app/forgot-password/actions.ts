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
  const origin = resolveSiteUrl();

  const supabase = createClient();

  // Supabase doesn't error here even if the email isn't registered — that's
  // deliberate, so this form can't be used to discover which emails exist.
  // We always show the same "check your email" message regardless.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  redirect(`/forgot-password?sent=1&email=${encodeURIComponent(email)}`);
}
