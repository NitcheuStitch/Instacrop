import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InstaCrop — AI Ad Creative Generator",
  description:
    "Upload one product image. Get multiple ad creatives in every size, instantly.",
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
