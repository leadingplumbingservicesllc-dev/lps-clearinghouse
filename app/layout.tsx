import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Leading Plumbing Services | Clearinghouse",
  description:
    "Verified public records, reviewed underwriting, and assignment-based liquidity.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
