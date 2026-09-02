"use server";

import { createClient } from "@/lib/supabase/server";

export type FeedbackCategory = "bug" | "idea" | "general";

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

  // Best-effort email notification — never fails the submission if this
  // fails, and does nothing at all until RESEND_API_KEY and
  // FEEDBACK_NOTIFY_EMAIL are set as environment variables.
  try {
    await sendFeedbackEmail({ email: user.email ?? "unknown", category: input.category, message });
  } catch {
    // The feedback row above is already saved — a failed notification
    // email is not a reason to tell the user their feedback didn't go in.
  }

  return { ok: true };
}

async function sendFeedbackEmail(input: { email: string; category: FeedbackCategory; message: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.FEEDBACK_NOTIFY_EMAIL;
  if (!apiKey || !notifyTo) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Ground Truth Estimator <onboarding@resend.dev>",
      to: [notifyTo],
      subject: `New feedback (${input.category}) — Ground Truth Estimator`,
      text: `From: ${input.email}\nCategory: ${input.category}\n\n${input.message}`,
    }),
  });
}
