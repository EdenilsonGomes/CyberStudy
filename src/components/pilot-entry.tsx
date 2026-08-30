import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";

export function PilotEntry() {
  return <Link href="/aulas/piloto-binario" className="pilot-entry"><span className="metric-icon"><FlaskConical size={20}/></span><span className="min-w-0"><small>Aula-piloto interativa</small><strong>Como os bits viram números</strong><span>Toque, experimente e descubra. Começar ou continuar.</span></span><ArrowRight size={18}/></Link>;
}
