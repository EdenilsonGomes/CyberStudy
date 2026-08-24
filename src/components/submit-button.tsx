"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  pendingText: string;
  confirmText?: string;
};

export function SubmitButton({ children, pendingText, ...props }: Props) {
  const { pending } = useFormStatus();
  return <button {...props} disabled={pending}>{pending ? pendingText : children}</button>;
}

export function ConfirmSubmitButton({ children, pendingText, confirmText = "Excluir este item? Esta ação não pode ser desfeita.", ...props }: Props) {
  const { pending } = useFormStatus();
  return <button {...props} disabled={pending} onClick={(event) => {
    if (!window.confirm(confirmText)) event.preventDefault();
  }}>{pending ? pendingText : children}</button>;
}

export function MaterialFeedback() {
  const params = useSearchParams();
  const topicCount = params.get("topicos");
  const count = Number(topicCount);
  const message = topicCount === "sem_ia" ? "Configure OPENAI_API_KEY ou MISTRAL_API_KEY no EasyPanel para organizar o material com inteligência." : topicCount === "erro" ? "Não foi possível gerar tópicos confiáveis. Nenhum tópico foi criado; confira a chave/modelo de IA e tente novamente." : topicCount !== null ? (count > 0 ? `${count} tópico${count === 1 ? " foi criado" : "s foram criados"} a partir do material.` : "Nenhum tópico novo foi encontrado; os existentes foram preservados.") : params.get("material") === "excluido" ? "Material excluído." : params.get("topico") === "excluido" ? "Tópico excluído." : "";
  return message ? <p className="mt-3 rounded-xl border p-3 text-sm" style={{ borderColor: "var(--brand)" }}>{message}</p> : null;
}
