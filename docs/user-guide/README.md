# User Guide

`guide.html` is the source for `public/GroundTruthEstimatorUserGuide.pdf` — the guide
linked from the in-app Help page and the top search bar.

## Updating the guide

1. Edit `guide.html`.
2. Rebuild the PDF by printing it with Edge (or Chrome) in headless mode. From the
   project folder in PowerShell:

   ```powershell
   & "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --no-pdf-header-footer --user-data-dir="$env:TEMP\guide-edge" --print-to-pdf="$PWD\public\GroundTruthEstimatorUserGuide.pdf" "file:///$($PWD -replace '\\','/')/docs/user-guide/guide.html"
   ```

   Page size, margins, and the "Page N" footer come from the `@page` rules in
   `guide.html`, so no print settings are needed.
3. Check which page each section landed on, then update the page numbers in:
   - the Contents list in `guide.html` (the `<span class="pg">` values) — rebuild again if
     they changed;
   - `lib/helpSearchIndex.ts` (the `pdfPage` fields), which the top search bar uses to
     open the PDF at the right page.
4. If the change affects what the app does, update the in-app Help page too:
   `app/dashboard/help/page.tsx`.
