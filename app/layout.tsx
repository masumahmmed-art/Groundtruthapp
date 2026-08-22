import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ground Truth Estimator",
  description:
    "First-principles cost estimating for Australian civil infrastructure projects.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
