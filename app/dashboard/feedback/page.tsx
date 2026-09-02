import FeedbackForm from "./FeedbackForm";

export default function FeedbackPage() {
  return (
    <div>
      <div className="titleblock">
        <div>
          <h2>Feedback</h2>
          <div className="meta">Found a bug, or have an idea? Tell us — it comes straight through.</div>
        </div>
      </div>

      <div className="section">
        <FeedbackForm />
      </div>
    </div>
  );
}
