import type { AuthoredLesson, AuthoredActivity } from "./interactive-lesson";

function hints(concept: string, example: string): AuthoredActivity["hints"] {
  return {
    explanation: [concept, example],
    purpose: ["Um computador guarda números como bits. Entender as posições permite ler esses números sem decorar uma tabela.", concept],
    term: ["Bit é um dígito: 0 ou 1. Peso é o valor de sua posição. Um bit 1 inclui esse peso na soma; um bit 0 não inclui.", concept],
    example: [example, concept],
    lost: ["Vamos por partes: olhe apenas o último dígito, à direita. Ele vale 1 quando está ligado e 0 quando desligado.", "Agora avance uma posição à esquerda: o peso dobra para 2. Continue: 4, 8, 16. Some só as posições ligadas."],
  };
}

// Authored pilot: no model call, keyword parsing or per-student generation cost.
// Unsigned positional notation only; signed numbers/endianness are intentionally out of scope.
export const binaryPilot: AuthoredLesson = {
  id: "binario-v1", version: 1, title: "Como os bits viram números",
  objective: "Montar e interpretar números binários sem decorar uma tabela.",
  steps: [
    { id: "explore", type: "switches", title: "Acenda o número 9", concept: "Soma dos pesos", assessment: false,
      instruction: "Cada botão é um bit. Ligado (1), ele acrescenta seu peso. Toque nos bits e observe a soma até chegar a 9.",
      weights: [8, 4, 2, 1], target: 9, showTotal: true, expected: "1001",
      explanation: "Você ligou 8 e 1. A soma é 9; os outros pesos ficaram desligados. Por isso 1001 representa 9.",
      misconception: "Conte o peso de cada posição ligada, não a quantidade de botões. Para chegar a 9, combine pesos cuja soma seja 9.",
      hints: hints("Os quatro pesos são 8, 4, 2 e 1. Só some os que estiverem ligados.", "Para montar 6, por exemplo, você ligaria 4 e 2: 0110. Agora tente o seu alvo.") },
    { id: "predict", type: "choice", title: "Preveja antes de revelar", concept: "Soma dos pesos", assessment: true,
      instruction: "O painel agora está travado. Quanto vale 1010? Faça a soma mentalmente e escolha.",
      pattern: "1010", weights: [8, 4, 2, 1], options: ["2", "10", "12", "1010"], expected: "10",
      explanation: "As posições de peso 8 e 2 estão ligadas: 8 + 2 = 10. Os zeros não entram na soma.",
      misconception: "Leia os pesos da esquerda para a direita e inclua apenas os que têm bit 1.",
      feedbackByAnswer: { "2": "Você contou dois bits ligados, mas cada posição tem um peso: aqui são 8 e 2, não 1 e 1.", "12": "12 seria 8 + 4 (1100). Em 1010, a posição de peso 4 está desligada; a de peso 2 está ligada.", "1010": "1010 está escrito em base 2, não em base 10. Suas posições têm pesos 8, 4, 2 e 1, não milhares e centenas." },
      hints: hints("Observe onde estão os dois bits 1 e some os pesos escritos acima deles.", "Em 0101, os pesos ligados seriam 4 e 1: total 5. Use a mesma regra no painel atual.") },
    { id: "match", type: "match", title: "Ligue duas formas de escrever", concept: "Representações equivalentes", assessment: true,
      instruction: "Cada par de bits representa um número. Associe cada escrita binária ao seu valor decimal.",
      items: [{ id: "eleven", label: "11 (binário)" }, { id: "one", label: "01 (binário)" }, { id: "ten", label: "10 (binário)" }], options: ["1", "2", "3"],
      expected: { eleven: "3", one: "1", ten: "2" },
      explanation: "Com dois bits, os pesos são 2 e 1: 11 vale 3, 01 vale 1 e 10 vale 2.",
      misconception: "Aqui há só duas posições: a da esquerda vale 2 e a da direita vale 1. Some os pesos ligados em cada linha.",
      hints: hints("Não leia 11 como onze: são dois bits ligados, com pesos 2 e 1.", "00 vale 0: nenhum peso ligado. 01 liga só o peso da direita. O que muda ao ligar o da esquerda?") },
    { id: "order", type: "order", title: "Reconstrua o painel", concept: "Valor de posição", assessment: true,
      instruction: "Os pesos se embaralharam. Toque na ordem em que devem aparecer, da esquerda para a direita, em um painel de quatro bits.",
      items: [{ id: "two", label: "2" }, { id: "eight", label: "8" }, { id: "one", label: "1" }, { id: "four", label: "4" }], expected: ["eight", "four", "two", "one"],
      explanation: "A ordem é 8 → 4 → 2 → 1. Partindo da direita, cada posição à esquerda dobra o peso.",
      misconception: "O menor peso fica à direita. Ao caminhar para a esquerda, cada peso dobra. Confira se sua sequência segue essa regra.",
      hints: hints("A posição mais à direita vale 1. Sua vizinha à esquerda vale o dobro.", "Num painel com três posições, os pesos são 4, 2, 1. Qual peso você acrescentaria à esquerda?") },
    { id: "transfer", type: "switches", title: "Agora monte 13 sozinho", concept: "Soma dos pesos", assessment: true,
      instruction: "Use os bits para montar 13. Desta vez, a soma só aparece depois da sua resposta. Você ainda pode pedir uma pista.",
      weights: [8, 4, 2, 1], target: 13, showTotal: false, expected: "1101",
      explanation: "8 + 4 + 1 = 13. A posição de peso 2 fica desligada: 1101.",
      misconception: "Comece pelo maior peso que cabe em 13. Depois veja quanto falta e escolha entre os pesos restantes, sem ultrapassar o alvo.",
      hints: hints("Escolha os pesos como moedas: cada um pode ser usado uma vez. A soma deve dar 13.", "Para montar 11, usaríamos 8 + 2 + 1. Seu alvo é 13: qual posição precisa mudar?") },
    { id: "extend", type: "choice", title: "E se aparecer mais um bit?", concept: "Valor de posição", assessment: true,
      instruction: "Um novo peso apareceu à esquerda. Use a mesma regra: quanto vale 11010?",
      pattern: "11010", weights: [16, 8, 4, 2, 1], options: ["18", "26", "3", "28"], expected: "26",
      explanation: "16 + 8 + 2 = 26. Você aplicou a regra em um painel maior, sem precisar decorar outra tabela.",
      misconception: "Os pesos agora são 16, 8, 4, 2 e 1. Olhe quais três posições estão ligadas.",
      feedbackByAnswer: { "18": "16 + 2 dá 18, mas há outro bit ligado: o da posição de peso 8.", "3": "Há três bits ligados, mas o valor vem da soma dos pesos 16, 8 e 2, não da contagem de bits.", "28": "28 seria 16 + 8 + 4. Em 11010, a posição de peso 4 está desligada; a de peso 2 está ligada." },
      hints: hints("Cada posição nova à esquerda dobra o peso anterior: depois de 8 vem 16.", "10001 seria 16 + 1 = 17. No seu painel, quais pesos estão ligados?") },
  ],
};
