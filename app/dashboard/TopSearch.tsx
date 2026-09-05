"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { helpSearchIndex, type HelpTopic } from "@/lib/helpSearchIndex";

function matches(topic: HelpTopic, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (topic.title.toLowerCase().includes(q)) return true;
  if (topic.description.toLowerCase().includes(q)) return true;
  return topic.keywords.some((k) => k.toLowerCase().includes(q));
}

export default function TopSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return helpSearchIndex.filter((t) => matches(t, query)).slice(0, 8);
  }, [query]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "Enter" && results.length > 0) {
      const first = results[0];
      if (first.helpAnchor) {
        window.location.href = `/dashboard/help#${first.helpAnchor}`;
        setOpen(false);
      } else if (first.pdfPage) {
        window.open(`/GroundTruthEstimatorUserGuide.pdf#page=${first.pdfPage}`, "_blank", "noreferrer");
      }
    }
  }

  return (
    <div className="topsearch" ref={wrapRef}>
      <span className="topsearch-icon" aria-hidden="true">🔎</span>
      <input
        type="text"
        placeholder="Search the help guide…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => query.trim() && setOpen(true)}
        onKeyDown={handleKeyDown}
        aria-label="Search the help guide"
      />
      {open && query.trim() && (
        <div className="topsearch-results">
          {results.length === 0 && (
            <div className="topsearch-empty">No matching topics — try a different word.</div>
          )}
          {results.map((topic) => (
            <div className="topsearch-row" key={topic.id}>
              {topic.helpAnchor ? (
                <Link
                  href={`/dashboard/help#${topic.helpAnchor}`}
                  className="topsearch-main"
                  onClick={() => setOpen(false)}
                >
                  <div className="topsearch-title">{topic.title}</div>
                  <div className="topsearch-desc">{topic.description}</div>
                </Link>
              ) : (
                <div className="topsearch-main topsearch-main-static">
                  <div className="topsearch-title">{topic.title}</div>
                  <div className="topsearch-desc">{topic.description}</div>
                </div>
              )}
              {topic.pdfPage && (
                <a
                  href={`/GroundTruthEstimatorUserGuide.pdf#page=${topic.pdfPage}`}
                  target="_blank"
                  rel="noreferrer"
                  className="topsearch-pdf"
                  onClick={(e) => e.stopPropagation()}
                >
                  PDF p.{topic.pdfPage}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
