import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { COOKIE_PALETTE, COOKIE_MODE, isPalette, isMode } from "@/lib/theme";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "DEPOT GNR — Air Isi Ulang",
  description: "Pesan galon isi ulang dari depot terdekat. Antar cepat, harga jujur.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DEPOT GNR",
  },
};

export const viewport: Viewport = {
  themeColor: "#00B7E4",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const c = await cookies();
  const paletteRaw = c.get(COOKIE_PALETTE)?.value;
  const modeRaw = c.get(COOKIE_MODE)?.value;
  const palette = isPalette(paletteRaw) ? paletteRaw : "aqua";
  const mode = isMode(modeRaw) ? modeRaw : "light";

  return (
    <html lang="id" data-palette={palette} data-mode={mode} className={jakarta.variable}>
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
