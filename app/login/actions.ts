"use server";

import { createClient } from "@/lib/supabase/server";

// Only allow redirects to a path on this site ("/dashboard", "/dashboard/projects/…"),
// never to another website — `next` comes from the URL, so it can't be trusted.
function safeNext(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";
}

// Returns where the browser should go next rather than calling redirect():
// the login form then does a full page load there, so the new session
// cookies are always in place before the dashboard (and middleware) run.
// A server-action redirect straight into a protected page could leave the
// login form stuck in local development.
export async function login(formData: FormData): Promise<{ redirectTo: string }> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const next = safeNext(String(formData.get("next") || "/dashboard"));
  const captchaToken = String(formData.get("cf-turnstile-response") || "") || undefined;

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });

  if (error) {
    return { redirectTo: `/login?error=${encodeURIComponent(error.message)}&email=${encodeURIComponent(email)}` };
  }

  return { redirectTo: next };
}
