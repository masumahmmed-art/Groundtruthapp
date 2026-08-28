import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase redirects here after an email confirmation / magic link / password
// reset click. Exchanges the one-time code in the URL for a real session,
// then sends the user on to their destination.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      // This happens for a few common, mostly unavoidable reasons: the link
      // was opened on a different device/browser than the one that
      // requested it (the matching one-time secret lives in a cookie on the
      // requesting browser), the link was already used once, it expired, or
      // a corporate email security scanner "clicked" it first to check it's
      // safe before the real user did. Whatever the cause, silently sending
      // the user to /dashboard (or /reset-password) here would strand them
      // with no real session and no explanation — instead, send them back
      // to request a fresh link with a clear reason why.
      const message =
        "That link didn't work — it may have expired, already been used, or been opened in a different browser than the one you requested it from. Please request a new one below.";
      return NextResponse.redirect(
        `${origin}/forgot-password?error=${encodeURIComponent(message)}`
      );
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
