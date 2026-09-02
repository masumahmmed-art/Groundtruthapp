"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/dashboard");
  const captchaToken = String(formData.get("cf-turnstile-response") || "") || undefined;

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}&email=${encodeURIComponent(email)}`);
  }

  redirect(next || "/dashboard");
}
