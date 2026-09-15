import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import "./demo.css";
import "./simulator.css";
import "./legal.css";
export const metadata: Metadata = {
  title: "Mandate — Mission Control",
  description:
    "A guided demonstration of outcome-bound authority for autonomous agents.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
