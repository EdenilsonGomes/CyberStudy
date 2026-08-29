import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = { title: { default: "CyberStudy", template: "%s · CyberStudy" }, description: "Seu espaço pessoal para entender, praticar e revisar Segurança da Informação." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#020b14" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="pt-BR" className="dark" suppressHydrationWarning><body>{children}</body></html>; }
