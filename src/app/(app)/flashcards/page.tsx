import Link from "next/link";
import { asc, lte } from "drizzle-orm";
import { getUserDb, owned } from "@/db/user-db";
import { flashcards } from "@/db/schema";
import { rateFlashcard } from "@/app/copilot-actions";
import { importLearningHistory } from "@/lib/copilot-data";
import { SubmitButton } from "@/components/submit-button";
export default async function FlashcardsPage() {
  await importLearningHistory(); const {db,userId}=await getUserDb();
  const rows=await db.select().from(flashcards).where(owned(flashcards,userId,lte(flashcards.due,new Date()))).orderBy(asc(flashcards.due)); const card=rows[0];
  return <div className="mx-auto max-w-xl space-y-5"><Link className="focus-back" href="/revisoes">← Praticar</Link><header><h1 className="page-title">Flashcards</h1><p className="muted mt-2">{rows.length} para revisar agora. Tente lembrar antes de revelar.</p></header>{card?<article className="card p-5 sm:p-8 space-y-5" key={`${card.id}:${card.revision}`}><h2 className="text-xl font-bold whitespace-pre-wrap break-words">{card.front}</h2><details><summary className="btn btn-primary cursor-pointer">Revelar resposta</summary><p className="callout whitespace-pre-wrap break-words mt-4">{card.back}</p><p className="label mt-6">Como foi lembrar?</p><form action={rateFlashcard} className="grid grid-cols-2 gap-3"><input type="hidden" name="id" value={card.id}/><input type="hidden" name="revision" value={card.revision}/>{[[1,"Esqueci"],[2,"Difícil"],[3,"Lembrei"],[4,"Fácil"]].map(([rating,label])=><SubmitButton pendingText="Salvando…" className="btn btn-secondary" key={rating} name="rating" value={rating}>{label}</SubmitButton>)}</form></details></article>:<div className="card p-6 space-y-3"><h2 className="section-title">Tudo em dia</h2><p className="muted">Os cartões reaparecem quando a revisão for necessária. Novas aulas geram cartões automaticamente.</p><Link className="btn btn-primary" href="/dashboard">Voltar ao plano</Link></div>}</div>;
}
