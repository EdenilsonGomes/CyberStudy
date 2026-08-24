import { Shell } from "@/components/shell";import { requireAuth } from "@/lib/auth";
export const dynamic="force-dynamic";
export default async function AppLayout({children}:{children:React.ReactNode}){await requireAuth();return <Shell>{children}</Shell>}
