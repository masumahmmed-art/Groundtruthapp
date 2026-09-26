"use server";

import { createClient } from "@/lib/supabase/server";
import { sendFeedbackEmail, type FeedbackEmailCategory } from "@/lib/feedbackEmail";

export type FeedbackCategory = FeedbackEmailCategory;

export async function submitFeedback(input: {
  category: FeedbackCategory;
  message: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const message = input.message.trim();
  if (!message) return { ok: false, error: "Please write a message before sending." };
  if (message.length > 4000) {
    return { ok: false, error: "That's a bit long — please keep it under 4000 characters." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in to send feedback." };

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const { error } = await supabase.from("feedback").insert({
    org_id: (membership as any)?.org_id ?? null,
    user_id: user.id,
    user_email: user.email,
    category: input.category,
    message,
  });

  if (error) return { ok: false, error: "Could not save your feedback — please try again." };

  // Best-effort email notification — never fails the submission. Failures
  // are logged inside sendFeedbackEmail (see lib/feedbackEmail.ts).
  try {
    await sendFeedbackEmail({ email: user.email ?? "unknown", category: input.category, message });
  } catch (err) {
    // The feedback row above is already saved — a failed notification
    // email is not a reason to tell the user their feedback didn't go in.
    console.error("[feedback-email] Unexpected error:", err instanceof Error ? err.message : String(err));
  }

  return { ok: true };
}
