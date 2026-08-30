import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function LessonProgress({ backHref, label, current, total, completed }: { backHref: string; label: string; current: number; total: number; completed: number }) {
  return <div className="lesson-progress-head"><Link href={backHref} aria-label="Sair da aula" className="focus-icon-button"><ArrowLeft size={20}/></Link><div className="min-w-0 flex-1"><div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold"><span className="min-w-0">{label}</span><span className="muted shrink-0">{current} / {total}</span></div><div className="progress" role="progressbar" aria-label="Etapas respondidas" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={total}><span style={{ width: `${completed / total * 100}%` }}/></div></div></div>;
}
