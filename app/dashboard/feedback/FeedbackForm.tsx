"use client";

import { useState } from "react";
import { submitFeedback, type FeedbackCategory } from "./actions";

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "bug", label: "Something's broken" },
  { value: "idea", label: "Feature idea / suggestion" },
  { value: "general", label: "General feedback" },
];

export default function FeedbackForm() {
  const [category, setCategory] = useState<FeedbackCategory>("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const result = await submitFeedback({ category, message });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("");
    setCategory("general");
    setSent(true);
  }

  if (sent) {
    return (
      <div className="card" style={{ padding: 22, maxWidth: 640 }}>
        <h3 style={{ margin: "0 0 6px" }}>Thanks — got it.</h3>
        <p style={{ margin: "0 0 16px" }}>Your feedback has been sent through.</p>
        <button className="btn btn-sm" onClick={() => setSent(false)}>
          Send another
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 22, maxWidth: 640 }}>
      <div className="field" style={{ marginBottom: 16 }}>
        <label>What's this about?</label>
        <select value={category} onChange={(e) => setCategory(e.target.value as FeedbackCategory)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field" style={{ marginBottom: 16 }}>
        <label>Your feedback</label>
        <textarea
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What happened, what you'd like to see, or anything else on your mind..."
          maxLength={4000}
        />
      </div>
      {error && (
        <div className="auth-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || !message.trim()}>
        {submitting ? "Sending…" : "Send feedback"}
      </button>
    </div>
  );
}
