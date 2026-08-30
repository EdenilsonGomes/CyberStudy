import { getDb } from "./index";
import { requireAuth } from "@/lib/auth";
export { owned, withOwner } from "./ownership";

export async function getUserDb() {
  const user = await requireAuth();
  return { db: getDb(), userId: user.id, user };
}
