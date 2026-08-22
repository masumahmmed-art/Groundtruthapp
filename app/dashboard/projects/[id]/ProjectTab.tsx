"use client";

import { createClient } from "@/lib/supabase/client";
import type { ProjectRow } from "@/lib/types";

export default function ProjectTab({
  project,
  setProject,
}: {
  project: ProjectRow;
  setProject: (updater: (p: ProjectRow) => ProjectRow) => void;
}) {
  const supabase = createClient();

  function change<K extends keyof ProjectRow>(key: K, value: ProjectRow[K]) {
    setProject((p) => ({ ...p, [key]: value }));
  }

  async function persist<K extends keyof ProjectRow>(key: K, value: ProjectRow[K]) {
    await supabase.from("projects").update({ [key]: value }).eq("id", project.id);
  }

  const fields: { key: keyof ProjectRow; label: string; type?: string }[] = [
    { key: "name", label: "Project name" },
    { key: "client", label: "Client" },
    { key: "location", label: "Location" },
    { key: "prepared_by", label: "Prepared by" },
    { key: "project_date", label: "Date", type: "date" },
  ];

  return (
    <div>
      <div className="card" style={{ padding: "22px 24px" }}>
        <div className="field-grid">
          {fields.map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={f.key}>{f.label}</label>
              <input
                id={f.key}
                type={f.type || "text"}
                value={(project[f.key] as string) || ""}
                onChange={(e) => change(f.key, e.target.value as any)}
                onBlur={(e) => persist(f.key, e.target.value as any)}
              />
            </div>
          ))}
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            rows={3}
            style={{ fontFamily: "var(--font-body)", resize: "vertical", padding: 8 }}
            value={project.notes || ""}
            onChange={(e) => change("notes", e.target.value)}
            onBlur={(e) => persist("notes", e.target.value)}
          />
        </div>
      </div>

      <div className="note" style={{ marginTop: 22 }}>
        <span>⚠</span>
        <span>
          <b>Indicative rates.</b> Your workspace&apos;s Rate Library ships pre-loaded with
          order-of-magnitude Australian civil rates so new projects work immediately. Replace them
          with your own supplier and subcontractor quotes on the Rate Library page before relying
          on this for a real tender.
        </span>
      </div>
    </div>
  );
}
