import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import { materialChunks } from "@/db/schema";

function words(value: string) {
  return [...new Set(value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\W+/).filter((word) => word.length > 3))];
}

export async function findContext(disciplineId: string, topicId: string | null, query: string) {
  const db = getDb();
  const chunks = await db.select().from(materialChunks)
    .where(topicId ? and(eq(materialChunks.disciplineId, disciplineId), or(eq(materialChunks.topicId, topicId), isNull(materialChunks.topicId))) : eq(materialChunks.disciplineId, disciplineId))
    .orderBy(asc(materialChunks.position)).limit(40);
  const terms = words(query);
  return chunks
    .map((chunk) => ({ content: chunk.content, score: terms.reduce((score, term) => score + (chunk.content.toLowerCase().includes(term) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => item.content.slice(0, 1800));
}

export function chunkText(content: string, size = 1800) {
  const normalized = content.replace(/\s+/g, " ").trim();
  const result: string[] = [];
  for (let start = 0; start < normalized.length; start += size - 200) {
    result.push(normalized.slice(start, start + size));
  }
  return result;
}

export async function recentRows<T extends { createdAt: Date }>(rows: Promise<T[]>, limit = 10) {
  return (await rows).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}

export { desc };
