import { Shell } from "@/components/shell";import { requireAuth } from "@/lib/auth";
export const dynamic="force-dynamic";
export default async function AppLayout({children}:{children:React.ReactNode}){const user=await requireAuth();return <Shell isTest={user.isTest}>{children}</Shell>}
