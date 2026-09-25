"use client";

import { useEffect, useRef, useState } from "react";
import type { createClient } from "@/lib/supabase/client";
import type { DrawingRow } from "@/lib/types";
import { RENDER_SCALE } from "./constants";

// Renders `page` of the selected drawing's PDF into `canvasRef`, and sizes
// `overlayRef` to match.
export function usePdfPage({
  supabase,
  selected,
  page,
  canvasRef,
  overlayRef,
}: {
  supabase: ReturnType<typeof createClient>;
  selected: DrawingRow | null;
  page: number;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  overlayRef: React.RefObject<HTMLCanvasElement>;
}) {
  const [numPages, setNumPages] = useState(1);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const pdfDocRef = useRef<any>(null);

  // Keyed on the drawing id, not the row: calibrating replaces the row
  // object, and that must not re-download and re-render the PDF.
  const selectedId = selected?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!selected) return;
      setLoadingPdf(true);
      try {
        const { data: signed, error: signErr } = await supabase.storage
          .from("drawings")
          .createSignedUrl(selected.storage_path, 300);
        if (signErr || !signed) throw signErr || new Error("Could not open drawing file");

        const pdfjsLib: any = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const doc = await pdfjsLib.getDocument(signed.signedUrl).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        if (doc.numPages !== selected.page_count) {
          supabase.from("drawings").update({ page_count: doc.numPages }).eq("id", selected.id).then(() => {});
        }

        const pdfPage = await doc.getPage(Math.min(page, doc.numPages));
        const viewport = pdfPage.getViewport({ scale: RENDER_SCALE });
        const canvas = canvasRef.current;
        const overlay = overlayRef.current;
        if (!canvas || !overlay) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        overlay.width = viewport.width;
        overlay.height = viewport.height;
        setPageSize({ width: viewport.width, height: viewport.height });
        const ctx = canvas.getContext("2d")!;
        await pdfPage.render({ canvasContext: ctx, viewport }).promise;
      } catch (err: any) {
        console.error(err);
      } finally {
        if (!cancelled) setLoadingPdf(false);
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [selectedId, page]);

  return { numPages, loadingPdf, pageSize };
}
