import Link from "next/link";
import { BookOpen, CalendarDays, Flame, History, LogOut, Mail, Settings, ShieldCheck, Target, UserRound } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { getUserDb, owned } from "@/db/user-db";
import { disciplines, reviews, studySessions } from "@/db/schema";
import { learningRhythm } from "@/lib/learning";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function ProfilePage() {
  const { db, userId, user } = await getUserDb();

  const [email, disciplineRows, sessionRows, pendingReviews] = await Promise.all([
    Promise.resolve(user.email || ""),
    db.select().from(disciplines).where(owned(disciplines, userId, eq(disciplines.status, "ATIVA"))),
    db.select().from(studySessions).orderBy(desc(studySessions.createdAt)).limit(120).where(owned(studySessions, userId)),
    db.select().from(reviews).where(owned(reviews, userId, eq(reviews.status, "PENDENTE"))),
  ]);
  const rhythm = learningRhythm(sessionRows.map((session) => session.createdAt));
  const name = user.name;

  return <div className="mx-auto max-w-4xl space-y-6"><header><p className="eyebrow">Conta e preferências</p><h1 className="page-title">Perfil</h1></header>
    <section className="card p-5 md:p-6"><div className="profile-head"><span className="avatar"><UserRound size={30}/></span><div className="min-w-0"><h2 className="truncate text-xl font-black">{name}</h2><p className="muted flex min-w-0 items-center gap-2 text-sm"><Mail className="shrink-0" size={14}/><span className="truncate">{email}</span></p><p className="muted mt-1 text-xs">{disciplineRows[0]?.semester || "Estudante CyberStudy"}</p></div></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="profile-stat"><Flame className="text-orange-400" size={20}/><strong>{rhythm.streak} dias</strong><span>sequência</span></div><div className="profile-stat"><Target className="text-[var(--brand)]" size={20}/><strong>{pendingReviews.length}</strong><span>revisões</span></div></div></section>

    <section className="card p-5"><h2 className="section-title mb-4 flex items-center gap-2"><BookOpen size={18}/>Curso e disciplinas</h2><div className="grid gap-3 sm:grid-cols-2">{disciplineRows.map((discipline) => <Link className="profile-discipline" href={`/disciplinas/${discipline.id}`} key={discipline.id}><ShieldCheck size={18} style={{ color: discipline.color }}/><span className="min-w-0"><strong className="block truncate text-sm">{discipline.name}</strong><small className="muted">{discipline.semester}</small></span></Link>)}</div></section>

    <section className="card p-5"><h2 className="section-title mb-4 flex items-center gap-2"><Settings size={18}/>Preferências</h2><ThemeToggle/></section>
    {user.isTest && <p className="rounded-xl border border-amber-400 p-4 text-sm">Conta de teste. O que você fizer aqui não altera o progresso da sua conta pessoal.</p>}
    {user.role === "admin" && <Link className="btn btn-secondary w-full" href="/perfil/contas">Administrar contas e convites</Link>}

    <details className="card p-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-extrabold"><span>Organização dos estudos</span><span className="muted text-xs font-normal">opcional</span></summary><div className="mt-4 grid gap-2 sm:grid-cols-3"><Link className="btn btn-secondary" href="/provas"><CalendarDays size={17}/>Provas</Link><Link className="btn btn-secondary" href="/historico"><History size={17}/>Histórico</Link><Link className="btn btn-secondary" href="/dificuldades"><Target size={17}/>Dificuldades</Link></div></details>
    <form action="/api/auth/logout" method="post"><button className="btn btn-ghost w-full"><LogOut size={17}/>Sair da conta</button><p className="muted text-center text-xs">Encerra as sessões desta conta em todos os dispositivos.</p></form>
  </div>;
}
