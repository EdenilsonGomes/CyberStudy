import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: { default: "CyberStudy", template: "%s · CyberStudy" }, description: "Seu espaço pessoal para entender, praticar e revisar Segurança da Informação." };
export default function RootLayout({ children }: LayoutProps<"/">) { return <html lang="pt-BR" className="dark" suppressHydrationWarning><body>{children}</body></html>; }
