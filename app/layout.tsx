import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ServicePro Planning",
  description: "Planning interface voor ServicePro"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
