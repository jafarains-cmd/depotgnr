import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Depot Air Minum",
  description: "Aplikasi manajemen depot air minum isi ulang",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
