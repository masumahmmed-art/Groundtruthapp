import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// First-touch signup-source attribution: if a visitor arrives with
// ?utm_source=... (or the shorter ?src=...), remember it in a cookie for 90
// days so that whenever they eventually sign up, we know which post/link
// actually brought them in. "First touch" on purpose — if they click a
// LinkedIn post today and sign up next week after coming back directly, the
// LinkedIn post still gets the credit. Returns null when there's nothing new
// to capture (no tag in the URL, or a source was already captured earlier).
const ATTRIBUTION_COOKIE = "gt_src";

function firstTouchSource(request: NextRequest): string | null {
  if (request.cookies.get(ATTRIBUTION_COOKIE)) return null;
  const params = request.nextUrl.searchParams;
  const source = params.get("utm_source") || params.get("src");
  if (!source) return null;
  const campaign = params.get("utm_campaign");
  return campaign ? `${source}:${campaign}` : source;
}

/**
 * Refreshes the Supabase auth session on every request and gatekeeps
 * everything except the marketing/auth pages behind a logged-in user.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });
  const attribution = firstTouchSource(request);
  const withAttribution = (res: NextResponse) => {
    if (attribution) {
      res.cookies.set(ATTRIBUTION_COOKIE, attribution, {
        maxAge: 60 * 60 * 24 * 90,
        path: "/",
        sameSite: "lax",
        httpOnly: true,
      });
    }
    return res;
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/auth") ||
    path.startsWith("/forgot-password");
  // /reset-password is intentionally NOT part of isAuthRoute: a visitor
  // lands there already authenticated (via the recovery link's one-time
  // code), and isAuthRoute would otherwise bounce them straight to
  // /dashboard before they get a chance to set a new password.
  const isResetPasswordRoute = path.startsWith("/reset-password");
  const isPublicRoute = path === "/" || isAuthRoute || isResetPasswordRoute;

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return withAttribution(NextResponse.redirect(url));
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return withAttribution(NextResponse.redirect(url));
  }

  return withAttribution(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
