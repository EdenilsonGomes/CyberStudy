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
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30_000, maxRetries: 1 });
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

export type SuggestedTopic = { name: string; description?: string };

function headingCandidates(title: string, content: string): SuggestedTopic[] {
  const lines = `${title}\n${content}`.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim());
  const seen = new Set<string>();
  const result: SuggestedTopic[] = [];
  for (const line of lines) {
    const looksLikeHeading = /^(unidade|cap[ií]tulo|m[oó]dulo|aula|tema|se[cç][aã]o|\d+(?:\.\d+)*\s*[-–.:])/i.test(line) || (line.length >= 8 && line.length <= 90 && line === line.toUpperCase());
    if (!looksLikeHeading || line.length > 120) continue;
    const name = line.replace(/^(unidade|cap[ií]tulo|m[oó]dulo|aula|tema|se[cç][aã]o)\s*\d*\s*[-–.:]?\s*/i, "").trim();
    const key = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (name.length < 5 || seen.has(key)) continue;
    seen.add(key);
    result.push({ name: name.slice(0, 140) });
    if (result.length === 8) break;
  }
  return result;
}

export async function suggestTopicsFromMaterial(input: { discipline: string; title: string; content: string }) {
  const fallback = headingCandidates(input.title, input.content);
  if (!process.env.OPENAI_API_KEY) return fallback;
  const normalized = input.content.replace(/\s+/g, " ");
  const middle = Math.floor(normalized.length / 2);
  const sample = [normalized.slice(0, 6000), normalized.slice(Math.max(0, middle - 2000), middle + 2000), normalized.slice(-3000)].join("\n---\n");
  try {
    const raw = await callAI(
      "Organize uma apostila em uma trilha curta de estudos. Retorne somente JSON válido, sem markdown. Não invente assuntos ausentes. Use nomes específicos e descrições de uma frase.",
      `Disciplina: ${input.discipline}\nMaterial: ${input.title}\nTrechos:\n${sample}\nFormato: {"topics":[{"name":"...","description":"..."}]}. Gere entre 4 e 10 tópicos em ordem pedagógica.`,
      1000,
    );
    const parsed = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()) as { topics?: SuggestedTopic[] };
    const topicRows = (parsed.topics || []).filter((topic) => typeof topic.name === "string" && topic.name.trim().length >= 4).slice(0, 10).map((topic) => ({ name: topic.name.trim().slice(0, 140), description: typeof topic.description === "string" ? topic.description.trim().slice(0, 600) : undefined }));
    return topicRows.length ? topicRows : fallback;
  } catch {
    return fallback;
  }
}
