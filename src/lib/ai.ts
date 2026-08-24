import OpenAI from "openai";

type TutorInput = {
  mode: string;
  discipline: string;
  topic: string;
  report: string;
  recentMessages?: Array<{ role: string; mode: string; content: string }>;
  context?: string[];
};

async function callAI(instructions: string, input: string, maxOutputTokens = 650) {
  if (!process.env.OPENAI_API_KEY) {
    return "A chave da OpenAI ainda não foi configurada. Seu relato foi salvo. Configure OPENAI_API_KEY para receber a orientação do tutor.";
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30_000, maxRetries: 1 });
  const request = (tokenLimit: number) => client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      instructions,
      input,
      max_output_tokens: tokenLimit,
      store: false,
    });
  const tokenLimit = Math.max(maxOutputTokens, 1400);
  let response = await request(tokenLimit);
  if (response.status === "incomplete" && response.incomplete_details?.reason === "max_output_tokens") {
    response = await request(tokenLimit * 2);
  }
  const output = response.output_text.trim();
  if (response.status !== "completed" || !output) {
    console.error("Resposta de IA inválida", { status: response.status, reason: response.incomplete_details?.reason || "sem_texto" });
    throw new Error("AI_EMPTY_RESPONSE");
  }
  return output;
}

export async function tutorReply(data: TutorInput) {
  const context = (data.context || []).slice(0, 4).join("\n\n---\n\n");
  const history = (data.recentMessages || []).slice(-8).map((message) => `${message.role} (${message.mode}): ${message.content.slice(0, 700)}`).join("\n");
  const modeRules: Record<string, string> = {
    EXPLICAR: "Comece a explicação imediatamente. Se houver uma lacuna de base, ensine essa base em vez de fazer outra rodada de diagnóstico.",
    DIAGNOSTICAR: "Faça no máximo uma pergunta curta se ainda faltar informação. Se o aluno já respondeu à última pergunta, use a resposta e comece a ensinar agora.",
    DAR_EXEMPLO: "Dê um exemplo concreto e curto, passo a passo, relacionado ao tópico.",
    CRIAR_EXERCICIO: "Crie um exercício curto sem revelar a solução e diga exatamente o que o aluno deve responder.",
    RESUMIR: "Entregue um resumo curto e organizado, sem fazer perguntas antes.",
    ME_TESTAR: "Faça uma pergunta que exija explicação com as próprias palavras, sem antecipar a resposta.",
  };
  return callAI(
    `Você é o tutor do CyberStudy e conversa em português do Brasil como um professor atento, não como um formulário. Modo atual: ${data.mode}. ${modeRules[data.mode] || modeRules.EXPLICAR}

Regras obrigatórias:
1. A mensagem atual é a continuação direta da conversa. Leia o histórico antes de responder.
2. Nunca repita uma pergunta que o aluno já respondeu. Se ele respondeu com uma opção, "sim", "não", "ambos" ou equivalente, reconheça e avance.
3. Não peça permissão para explicar quando o aluno já pediu uma explicação, exemplo ou recapitulação.
4. Se o aluno disser que você bugou, repetiu ou não entendeu a resposta dele, reconheça em uma frase e retome do ponto correto.
5. Entregue conteúdo útil antes de fazer uma nova pergunta. Use blocos curtos e exemplos simples; não despeje uma aula longa.
6. Faça no máximo uma pergunta ao final e somente para verificar compreensão ou obter informação realmente indispensável.
7. Não mande o aluno responder apenas uma palavra ou letra, salvo quando isso simplificar a primeira pergunta de diagnóstico.
8. Não invente fatos ausentes no material. Exemplos próprios devem ser claramente didáticos e corretos.`,
    `Disciplina: ${data.discipline}\nTópico: ${data.topic}\nHistórico recente em ordem cronológica:\n${history || "sem histórico anterior"}\n\nMENSAGEM ATUAL DO ALUNO:\n${data.report}\n\nTrechos relevantes do material:\n${context || "nenhum material cadastrado"}`,
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

function cleanSuggestedTopics(value: unknown): SuggestedTopic[] {
  if (!value || typeof value !== "object" || !("topics" in value) || !Array.isArray(value.topics)) return [];
  const seen = new Set<string>();
  return value.topics.flatMap((item) => {
    if (!item || typeof item !== "object" || !("name" in item) || typeof item.name !== "string") return [];
    const name = item.name.replace(/\s+/g, " ").replace(/^[\s\-–—:;,.]+|[\s\-–—:;,.]+$/g, "").trim();
    const letters = (name.match(/[A-Za-zÀ-ÿ]/g) || []).length;
    const digits = (name.match(/\d/g) || []).length;
    const words = name.match(/[A-Za-zÀ-ÿ]{2,}/g) || [];
    const key = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const isFormula = /[=×÷]|\b\d+\s*[xX]\s*\d+\b/.test(name);
    const isFragment = /^(de|do|da|dos|das|e|ou|para|com)\b/i.test(name);
    if (name.length < 8 || name.length > 140 || words.length < 2 || letters < 6 || digits > letters / 4 || isFormula || isFragment || seen.has(key)) return [];
    seen.add(key);
    const description = "description" in item && typeof item.description === "string" ? item.description.replace(/\s+/g, " ").trim().slice(0, 600) : undefined;
    return [{ name, description }];
  }).slice(0, 10);
}

async function callMistralForTopics(system: string, prompt: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.MISTRAL_MODEL || "mistral-small-latest",
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1200,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Mistral respondeu ${response.status}`);
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("Resposta vazia da Mistral");
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

export async function suggestTopicsFromMaterial(input: { discipline: string; title: string; content: string }) {
  if (!process.env.OPENAI_API_KEY && !process.env.MISTRAL_API_KEY) throw new Error("AI_NOT_CONFIGURED");
  const normalized = input.content.replace(/\s+/g, " ");
  const middle = Math.floor(normalized.length / 2);
  const sample = [normalized.slice(0, 6000), normalized.slice(Math.max(0, middle - 2000), middle + 2000), normalized.slice(-3000)].join("\n---\n");
  const system = "Organize uma apostila em uma trilha curta de estudos. Retorne somente JSON válido. Não use títulos partidos, cabeçalhos institucionais, números soltos, fórmulas, exemplos ou exercícios como tópicos. Não invente assuntos ausentes. Una conceitos relacionados e use nomes específicos com descrições de uma frase.";
  const prompt = `Disciplina: ${input.discipline}\nMaterial: ${input.title}\nTrechos:\n${sample}\nFormato obrigatório: {"topics":[{"name":"...","description":"..."}]}. Gere entre 4 e 10 tópicos conceituais em ordem pedagógica.`;
  try {
    const raw = process.env.MISTRAL_API_KEY ? await callMistralForTopics(system, prompt) : await callAI(system, prompt, 1200);
    const parsed = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()) as unknown;
    const topicRows = cleanSuggestedTopics(parsed);
    if (topicRows.length < 3) throw new Error("INVALID_TOPICS");
    return topicRows;
  } catch {
    throw new Error("TOPIC_GENERATION_FAILED");
  }
}
