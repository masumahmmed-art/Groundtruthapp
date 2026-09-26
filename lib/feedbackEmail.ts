// Emails a copy of each feedback submission to the site owner via Resend.
// Best-effort: the feedback row is already saved before this runs, so a
// failure here never reaches the user — but it is logged (visible in the
// Vercel function logs) so a broken key or blocked address doesn't go
// unnoticed. Logs never include the API key, the sender's email address,
// or the message text.

export type FeedbackEmailCategory = "bug" | "idea" | "general";

const LOG_PREFIX = "[feedback-email]";

export async function sendFeedbackEmail(input: {
  email: string;
  category: FeedbackEmailCategory;
  message: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.FEEDBACK_NOTIFY_EMAIL;
  if (!apiKey || !notifyTo) {
    const missing = [!apiKey && "RESEND_API_KEY", !notifyTo && "FEEDBACK_NOTIFY_EMAIL"].filter(Boolean);
    console.warn(`${LOG_PREFIX} Not sent: ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} not set. The feedback itself was saved.`);
    return;
  }

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
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
  } catch (err) {
    console.error(`${LOG_PREFIX} Could not reach Resend: ${err instanceof Error ? err.message : String(err)}. The feedback itself was saved.`);
    return;
  }

  if (!res.ok) {
    // Resend returns JSON like { "name": "validation_error", "message": "..." }.
    let reason = "";
    try {
      const body = await res.json();
      reason = [body?.name, body?.message].filter(Boolean).join(": ");
    } catch {
      // Non-JSON error body — the status code alone still says a lot.
    }
    console.error(`${LOG_PREFIX} Resend rejected the email (HTTP ${res.status})${reason ? ` — ${reason}` : ""}. The feedback itself was saved.`);
  }
}
