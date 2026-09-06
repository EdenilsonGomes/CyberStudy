import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./rumevo-brand.css";

export const metadata: Metadata = {
  title: { default: "Rumevo", template: "%s · Rumevo" },
  description: "Aprender com direção. Seu espaço para entender, praticar e revisar no seu ritmo.",
  icons: { icon: "/rumevo-mark.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B1F3B",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
