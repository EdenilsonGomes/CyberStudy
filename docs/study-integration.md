# Estudo interativo integrado — 30/08/2026

## Implementado

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
