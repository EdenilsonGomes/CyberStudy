import { redirect } from "next/navigation";

// Keep old bookmarks and login callbacks working; there is one study entry point.
export default function DashboardPage() { redirect("/disciplinas"); }
