import OpenAI from "openai";

type TutorInput = {
  mode: string;
  discipline: string;
  topic: string;
  report: string;
  recentMessages?: string[];
  context?: string[];
};

async function callAI(instructions: string, input: string, maxOutputTokens = 650) {
  if (!process.env.OPENAI_API_KEY) {
    return "A chave da OpenAI ainda não foi configurada. Seu relato foi salvo. Configure OPENAI_API_KEY para receber a orientação do tutor.";
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    instructions,
    input,
    max_output_tokens: maxOutputTokens,
    store: false,
  });
  return response.output_text.trim();
}

export async function tutorReply(data: TutorInput) {
  const context = (data.context || []).slice(0, 4).join("\n\n---\n\n");
  const history = (data.recentMessages || []).slice(-6).join("\n");
  return callAI(
    `Você é o tutor do CyberStudy. Ensine Segurança da Informação em português do Brasil. Modo: ${data.mode}. Faça diagnóstico antes de explicar quando houver lacuna. Use blocos curtos, no máximo uma pergunta por vez, linguagem acolhedora e exemplos técnicos seguros. Não despeje uma aula longa nem entregue solução de exercício sem estimular raciocínio. Termine verificando compreensão.`,
    `Disciplina: ${data.discipline}\nTópico: ${data.topic}\nRelato atual: ${data.report}\nHistórico recente:\n${history || "sem histórico"}\nTrechos relevantes do material:\n${context || "nenhum material cadastrado"}`,
  );
}

export type GeneratedQuestion = {
  prompt: string;
  type: "MULTIPLA_ESCOLHA" | "VERDADEIRO_FALSO";
  options: string[];
  correctAnswer: string;
  explanation: string;
};

export async function generateQuizQuestions(input: { discipline: string; topic: string; count: number; context: string[] }) {
  if (!process.env.OPENAI_API_KEY) {
    const base: GeneratedQuestion[] = Array.from({ length: input.count }, (_, index) => ({
      prompt: `${index + 1}. Qual afirmação melhor demonstra compreensão de ${input.topic}?`,
      type: "MULTIPLA_ESCOLHA",
      options: ["Aplicar o conceito explicando seu propósito", "Apenas memorizar o nome", "Ignorar pré-requisitos", "Usar sem validar"],
      correctAnswer: "Aplicar o conceito explicando seu propósito",
      explanation: "Compreender envolve explicar a finalidade e aplicar o conceito em contexto.",
    }));
    return base;
  }
  const raw = await callAI(
    "Gere somente JSON válido, sem markdown. Crie questões didáticas, inequívocas e seguras. Misture múltipla escolha e verdadeiro/falso. Cada resposta correta precisa ser exatamente uma das opções.",
    `Crie ${input.count} questões sobre ${input.topic}, da disciplina ${input.discipline}. Use estes trechos quando disponíveis:\n${input.context.slice(0, 4).join("\n---\n")}\nFormato: {"questions":[{"prompt":"...","type":"MULTIPLA_ESCOLHA","options":["..."],"correctAnswer":"...","explanation":"..."}]}`,
    1800,
  );
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as { questions: GeneratedQuestion[] };
    return parsed.questions.slice(0, input.count).filter((q) => q.prompt && q.options?.includes(q.correctAnswer));
  } catch {
    throw new Error("A IA não retornou um quiz válido. Tente novamente.");
  }
}

export async function evaluateUnderstanding(input: TutorInput & { answer: string }) {
  return callAI(
    "Avalie uma explicação de estudante em português do Brasil. Comece obrigatoriamente com ENTENDEU, PARCIAL ou PRECISA_REVISAR. Depois diga em até 4 frases o que ficou bom, o que faltou e uma pergunta curta para consolidar. Seja acolhedor.",
    `Disciplina: ${input.discipline}\nTópico: ${input.topic}\nDesafio: ${input.report}\nResposta do estudante: ${input.answer}\nContexto do material:\n${(input.context || []).slice(0, 3).join("\n---\n")}`,
    450,
  );
}
