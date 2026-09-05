# Copiloto acadêmico

Hoje reúne diagnóstico por conceito, próximo conteúdo, revisões e preparação para os compromissos da agenda. O orçamento diário fica entre 5 e 120 minutos; as durações são estimativas. O planejamento preserva a ordem das aulas e não oferece novamente um tópico concluído no mesmo dia. Agenda inclui provas, exercícios, trabalhos, aulas e outros compromissos, com seleção de conteúdos por disciplina. Provas anteriores continuam visíveis e participam do plano.

Os resultados das aulas interativas alimentam domínio, amostras e erros por conceito. A primeira resposta sem ajuda vale integralmente; respostas corrigidas/com apoio valem 35%. O resultado recente tem peso 65% quando existe histórico. Diagnósticos não concluem aulas. A conclusão do PDF continua sendo cobertura; domínio requer ao menos 80% e três respostas avaliadas por conceito. XP representa conceitos que atendem esses critérios, sem premiar cliques ou repetições.

Histórico interativo é importado uma vez por sessão, em ordem cronológica, usando uma tabela de deduplicação. Checkpoints, conclusão, evidência e geração de cartões são transacionais. Quizzes e microaulas existentes também atualizam a memória quando respondidos. O tutor recebe conceitos, erros, últimas atividades, títulos dos materiais e compromissos, tratados como dados.

Um flashcard por conceito é gerado das atividades preparadas, preferindo erros. O estado e os registros do [ts-fsrs](https://open-spaced-repetition.github.io/ts-fsrs/) ficam no PostgreSQL. Avaliação de cartão bloqueia a linha e verifica revisão para impedir atualização duplicada. Autoavaliação do flashcard agenda a repetição; não equivale a uma resposta objetiva de domínio.

Modo prova usa questões dos materiais já preparados, distribuídas entre conceitos, priorizando lacunas. Seleção pode ser por disciplina, material ou avaliação. O gabarito permanece no servidor até a conclusão; cada resposta é salva e o prazo de 90 segundos por questão é verificado no servidor. Respostas em branco contam como erro. O percentual é desempenho no simulado, não previsão de nota oficial. Conteúdo sem questões preparadas solicita estudo/preparação, sem perguntas genéricas fabricadas.

Migração 0007 é aditiva. Chaves compostas de proprietário preservam o isolamento dos dados. A imagem existente executa as migrações antes de iniciar o servidor. A versão de saúde é `copilot-r1`. Publicação continua pelo EasyPanel, sem mudança de infraestrutura.

## Verificação local

`pnpm test`, `pnpm lint`, `pnpm build`.

`node --experimental-strip-types scripts/preview-copilot.mjs` abre um banco volátil com dados fictícios em 127.0.0.1:5439 e aplicação em 127.0.0.1:3100. Conta: `preview@example.test`; senha exclusivamente local: `Local-preview-only-123`. O script usa URL fixa local e não lê credenciais de produção. Não há chave de IA nesse ambiente; a geração por provedor precisa ser conferida no ambiente configurado. Encerre o processo para descartar os dados.

Limites: domínio é uma estimativa transparente pelas respostas, não uma medida validada psicometricamente. A identificação de confusões usa feedback pedagógico e histórico de erros; não existe um classificador independente de causas cognitivas. Preparação regressiva calcula metas por conceito e seleciona o próximo conteúdo dentro do orçamento; não promete concluir um volume incompatível com o tempo disponível.
