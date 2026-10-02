"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get("token") || "");
  const supabase = createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) {
    redirect(`/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard?joined=1");
}

export async function signOutForInvite(formData: FormData) {
  const token = String(formData.get("token") || "");
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
}
