import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// The middleware already gatekeeps everything, so the root route just
// forwards to the right place — no separate marketing page for the MVP.
export default async function RootPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/login");
}
