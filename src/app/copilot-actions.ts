"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fsrs } from "ts-fsrs";
import { getUserDb, owned, withOwner } from "@/db/user-db";
import { academicEvents, cardReviews, disciplines, flashcards, materialDecisions, materials } from "@/db/schema";
import { assertStudyScope } from "@/lib/data";
import { agendaKinds, validDay } from "@/lib/copilot";
import { uuidPattern } from "@/lib/study-contract";
import { loadTrail } from "@/lib/trail-data";
const value = (f: FormData, k: string) => String(f.get(k) || "").trim();
export async function saveAcademicEvent(form: FormData) {
  const { db, userId } = await getUserDb();
  const disciplineId = value(form, "disciplineId"), name = value(form, "name"), kind = value(form, "kind"), date = value(form, "date"), id = value(form, "id");
  if (!name || name.length > 140 || !Object.hasOwn(agendaKinds, kind) || !validDay(date)) redirect("/agenda?erro=campos");
  await assertStudyScope(disciplineId);
  const topicIds = [...new Set(form.getAll("topicIds").map(String))];
  for (const topicId of topicIds) await assertStudyScope(disciplineId, topicId);
  const data = { disciplineId, name, kind, date, topicIds, notes: value(form,"notes").slice(0,2000), updatedAt: new Date() };
  if (id) { if (!uuidPattern.test(id)) throw new Error("Compromisso inválido"); await db.update(academicEvents).set(data).where(owned(academicEvents,userId,eq(academicEvents.id,id))); }
  else await db.insert(academicEvents).values(withOwner(userId,data));
  revalidatePath("/dashboard"); revalidatePath("/agenda"); redirect("/agenda?salvo=1");
}
export async function finishAcademicEvent(form: FormData) {
  const { db, userId } = await getUserDb(); const id = value(form,"id");
  if (!uuidPattern.test(id)) throw new Error("Compromisso inválido");
  await db.update(academicEvents).set({ completed: value(form,"completed") === "1", updatedAt: new Date() }).where(owned(academicEvents,userId,eq(academicEvents.id,id)));
  revalidatePath("/agenda"); revalidatePath("/dashboard");
}
export async function rateFlashcard(form: FormData) {
  const { db, userId } = await getUserDb(); const id = value(form,"id"), rating = Number(value(form,"rating")), revision = Number(value(form,"revision"));
  if (!uuidPattern.test(id) || ![1,2,3,4].includes(rating) || !Number.isInteger(revision)) throw new Error("Revisão inválida");
  await db.transaction(async tx => {
    const [card] = await tx.select().from(flashcards).where(owned(flashcards,userId,eq(flashcards.id,id))).for("update");
    if (!card || card.revision !== revision || card.due > new Date()) return;
    const result = fsrs().next(card.schedule,new Date(),rating as 1|2|3|4);
    await tx.update(flashcards).set({ schedule: result.card, due: result.card.due, revision: revision+1, updatedAt: new Date() }).where(owned(flashcards,userId,and(eq(flashcards.id,id),eq(flashcards.revision,revision))));
    await tx.insert(cardReviews).values(withOwner(userId,{ cardId:id, rating, log:result.log }));
  });
  revalidatePath("/flashcards"); revalidatePath("/dashboard");
}
export async function decideMaterial(form: FormData) {
  const { db,userId } = await getUserDb(); const materialId = value(form,"materialId"), decision = value(form,"decision");
  if (!uuidPattern.test(materialId) || !["ENCERRADO","AGUARDANDO","FINALIZADO"].includes(decision)) throw new Error("Escolha inválida");
  const [material] = await db.select().from(materials).where(owned(materials,userId,eq(materials.id,materialId)));
  if (!material) throw new Error("Material não encontrado");
  const trail = await loadTrail(material.disciplineId);
  if (!trail.groups.find(g => g.materialId === materialId)?.done) throw new Error("Conclua o conteúdo antes de encerrar.");
  await db.transaction(async tx => {
    await tx.insert(materialDecisions).values(withOwner(userId,{materialId,decision})).onConflictDoUpdate({ target:[materialDecisions.userId,materialDecisions.materialId], set:{decision,updatedAt:new Date()} });
    if (decision === "FINALIZADO") await tx.update(disciplines).set({ status:"FINALIZADA", updatedAt:new Date() }).where(owned(disciplines,userId,eq(disciplines.id,material.disciplineId)));
  });
  revalidatePath("/dashboard"); redirect(`/disciplinas/${material.disciplineId}?encerrado=1`);
}
