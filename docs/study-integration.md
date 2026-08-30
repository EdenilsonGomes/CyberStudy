# Estudo interativo integrado — 30/08/2026

## Nova tentativa de publicação

A primeira publicação retornou 502 e foi restaurada. Sem logs do EasyPanel não foi possível atribuir a falha a uma causa específica. Nesta revisão, a checagem do histórico de migrações e o DDL ficam sob o mesmo bloqueio transacional; há timeout e erro identificando migration/SQLSTATE, sem imprimir credenciais. O container escuta explicitamente em 0.0.0.0, encaminha sinais ao processo Node e inclui healthcheck. `/api/health` identifica esta versão como `interactive-study-r4`.

A republicação r2/r3 subiu com saúde 200 e acesso autenticado ao banco real. O teste de Hoje → Começar encontrou uma falha diferente: `INVALID_OPTIONS` na geração de atividades. Agora ambos os provedores recebem JSON Schema estrito, inclusive alternativas no nível correto e limites de texto. O adaptador de associações mantém o contrato das sessões existentes. As validações de fonte, gabarito e variedade pedagógica permanecem obrigatórias. A primeira preparação tem limite de 120 s, sem repetição automática de chamadas; falhas expõem somente códigos permitidos.

Os testes do executor usam um banco simulado para verificar ordem, rollback e ausência de reaplicação. Eles NÃO validam a execução do SQL no PostgreSQL. Não havia banco configurado localmente e a instalação foi negada pelo ambiente. A validação com banco real depende da publicação/ambiente disponibilizado.

## Implementado

- Correção r5 para `INVALID_ANSWER_KEY`: novas questões e associações referenciam alternativas por índice limitado no schema. O servidor resolve o texto canônico e valida o gabarito, sem expor índices corretos ao cliente. Pacotes existentes continuam no contrato anterior, sem migração ou perda de progresso.
- Correção r6 para `UNSUPPORTED_SOURCE`: a IA seleciona um ID de trecho fornecido, e o servidor resolve fonte/citação a partir do material original. A validação literal permanece; referências inexistentes são rejeitadas. A citação continua sendo evidência para revisão humana, não prova automática da correção pedagógica.

- Hoje → Começar, Trilha → aula e antigas URLs `estudar?topico=...&sessao=1` usam o mesmo motor do piloto. O piloto autoral continua disponível.
- Conteúdo estruturado gerado sob demanda a partir dos trechos já cadastrados; decisão em cenário, associação e ordenação reais. Contrato validado, limites de texto, gabaritos válidos e citação literal existente. Falhas não viram perguntas genéricas.
- Cache por conteúdo/fonte/versão, reserva de geração e chave única de sessão ativa. Nenhuma geração em GET ou retomada. As definições concluídas permanecem imutáveis para preservar sessões antigas.
- Diagnóstico opcional de até três tópicos iniciais com material, duas questões por tópico, opção Ainda não sei, correção só no final. Dois acertos independentes indicam início pela aplicação; demais começam pela base. Tópicos fora da amostra continuam não avaliados. Não altera domínio nem conta como sessão de estudo.
- Checkpoints transacionais de etapa, respostas, pistas e tentativas; revisão de estado impede sobreposição entre abas. Rascunho local persiste no dispositivo; Salvar e sair também salva a seleção no banco. Não é necessário gerar conteúdo novamente ao retomar.
- Navegação global oculta no foco em mobile e desktop. Seta abre confirmação acessível de pausa. O botão voltar do navegador pode sair sem esse modal: respostas confirmadas continuam no banco e seleção não confirmada no dispositivo. Não se promete interceptar todo gesto do sistema operacional.
- Resultados distinguem acerto inicial e correção com ajuda. Histórico, Praticar, Progresso e conclusão da Trilha reutilizam os registros. Revisões usam a tabela e a regra simples existente (1 ou 3 dias), sem FSRS.
- Migração 0003 aditiva. Aulas e conversas antigas não são apagadas. Resultados antigos continuam nas URLs existentes; aula legada pode ser aberta com `?legado=1`.

## Limites deliberados / pendente implementar

- Cadastro, recuperação de senha e isolamento por usuário. Continua o modelo de conta administrativa única; NÃO abrir cadastro antes de adicionar ownership às tabelas.
- Diagnóstico de toda a disciplina, cobertura de pré-requisitos e reavaliação com questões inéditas. Nesta rodada é uma amostra inicial, não uma estimativa de domínio contínua.
- Geração de novas variantes a cada revisão. Por enquanto reaproveita atividades, o que economiza chamadas, mas não comprova retenção com questões inéditas.
- Avaliação humana da correção pedagógica por disciplina, especialmente conteúdo de saúde. Validar citação literal não prova que toda inferência da IA é correta.
- FSRS, pyBKT, memória acadêmica, Judge0, pgvector e gamificação complexa permanecem fora do escopo.
- Rascunho ainda não enviado só existe no dispositivo até Salvar e sair; não há sincronização contínua de cada toque entre dispositivos.
- Sessões anteriores à integração não possuíam checkpoint de etapa recuperável: preservamos mensagens/histórico, não inventamos um ponto de retomada passado.

## Verificação

Automatizados: contrato genérico, fonte inexistente, resposta inválida, texto longo, rejeição de aula só com questões, diagnóstico duplicado, dois acertos, Ainda não sei, ausência de pistas/gabarito no cliente, adaptação, rascunho, serialização e concorrência. Executar `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.

Aceitação publicada: Hoje → aula real → dúvida → erro → correção → pausa → Hoje/Continuar → recarga → conclusão → Praticar → Progresso → Perfil; diagnóstico → resultado por conceito → aula adaptada; revisão do piloto e das conversas anteriores.

Pendente validar em dispositivos: 320/360/390/430 px, teclado virtual, safe-area, gesto de voltar, sessão em dois dispositivos, rede interrompida e primeira autenticação com credenciais. O navegador disponível não oferece emulação de viewport; não tratar revisão estática de CSS como teste mobile executado.
