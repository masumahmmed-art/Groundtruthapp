"use client";

import { useEffect, useRef, useState } from "react";
import type { createClient } from "@/lib/supabase/client";
import type { DrawingRow } from "@/lib/types";
import { RENDER_SCALE } from "./constants";
import { isDxfName } from "@/lib/takeoff";

// Renders `page` of the selected drawing's PDF into `canvasRef`, and sizes
// `overlayRef` to match. Older drawings (storage_path set) load from the
// Storage bucket; newer ones are kept on the user's PC and load from
// `localBytes` — until those are available nothing is rendered.
// DXF drawings (always kept on the PC) are drawn from their vectors instead;
// they are a single page, and `dxfScale` is the scale the file's own units
// give, if it states any.
export function usePdfPage({
  supabase,
  selected,
  localBytes,
  page,
  canvasRef,
  overlayRef,
}: {
  supabase: ReturnType<typeof createClient>;
  selected: DrawingRow | null;
  localBytes: ArrayBuffer | null;
  page: number;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  overlayRef: React.RefObject<HTMLCanvasElement>;
}) {
  const [numPages, setNumPages] = useState(1);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  // Bumped after every successful render: resizing the overlay canvas clears
  // it, so the caller redraws the saved shapes when this changes.
  const [renderCount, setRenderCount] = useState(0);
  const pdfDocRef = useRef<any>(null);
  // Tagged with the drawing it belongs to, so a scale can never be applied to
  // a different drawing selected before the next render finishes.
  const [dxfScale, setDxfScale] = useState<{ drawingId: string; scale: { px_per_unit: number; unit: string } } | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Keyed on the drawing id, not the row: calibrating replaces the row
  // object, and that must not re-download and re-render the PDF.
  const selectedId = selected?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!selected) return;
      if (!selected.storage_path && !localBytes) return; // waiting for the user to open the file
      setLoadingPdf(true);
      setRenderError(null);
      setDxfScale(null);
      try {
        if (isDxfName(selected.name) && localBytes) {
          // Loaded only when a DXF is opened, like pdf.js below.
          const { DxfError, dxfAutoScale, layoutDxf, parseDxf, renderDxf } = await import("@/lib/dxf");
          const drawing = parseDxf(localBytes);
          const layout = layoutDxf(drawing);
          if (!layout) throw new DxfError("This DXF has nothing in model space that can be drawn.");
          const canvas = canvasRef.current;
          const overlay = overlayRef.current;
          if (!canvas || !overlay || cancelled) return;
          setNumPages(1);
          canvas.width = layout.width;
          canvas.height = layout.height;
          overlay.width = layout.width;
          overlay.height = layout.height;
          setPageSize({ width: layout.width, height: layout.height });
          renderDxf(canvas.getContext("2d")!, drawing, layout);
          const auto = dxfAutoScale(drawing, layout);
          setDxfScale(auto ? { drawingId: selected.id, scale: auto } : null);
          setRenderCount((n) => n + 1);
          return;
        }

        const pdfjsLib: any = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        let source: unknown;
        if (selected.storage_path) {
          const { data: signed, error: signErr } = await supabase.storage
            .from("drawings")
            .createSignedUrl(selected.storage_path, 300);
          if (signErr || !signed) throw signErr || new Error("Could not open drawing file");
          source = signed.signedUrl;
        } else {
          // pdf.js takes ownership of the buffer it's given, so pass a copy.
          source = { data: new Uint8Array(localBytes!.slice(0)) };
        }

        const doc = await pdfjsLib.getDocument(source).promise;
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
        if (!canvas || !overlay || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        overlay.width = viewport.width;
        overlay.height = viewport.height;
        setPageSize({ width: viewport.width, height: viewport.height });
        const ctx = canvas.getContext("2d")!;
        await pdfPage.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setRenderCount((n) => n + 1);
      } catch (err: any) {
        console.error(err);
        if (!cancelled) setRenderError(err?.name === "DxfError" ? err.message : "Couldn't display this drawing.");
      } finally {
        if (!cancelled) setLoadingPdf(false);
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [selectedId, page, localBytes]);

  return { numPages, loadingPdf, pageSize, renderCount, dxfScale, renderError };
}
