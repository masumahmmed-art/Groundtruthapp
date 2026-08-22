"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export async function signup(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const origin = headers().get("origin");

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}&email=${encodeURIComponent(email)}`);
  }

  // If your Supabase project has "Confirm email" turned on (the default),
  // there is no session yet — send the user to check their inbox instead
  // of straight to the dashboard.
  if (data.user && !data.session) {
    redirect(`/signup?check-email=1&email=${encodeURIComponent(email)}`);
  }

  redirect("/dashboard");
}
