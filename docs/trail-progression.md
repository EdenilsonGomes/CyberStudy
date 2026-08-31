# Trilha e conclusão de unidade — trail-r1

- `/` e o antigo `/dashboard` levam à Trilha. A disciplina inicial é a última estudada, ou a primeira ativa quando não há estudo.
- `buildTrail` define a mesma ordem e contagem usadas na Trilha, no início da aula e em Progresso. Revisões não entram nessa ordenação.
- O avanço é cobertura das aulas, não domínio. Uma atividade respondida com erro pode encerrar a aula e recomendar reforço separadamente.
- A última resposta salva a conclusão no servidor, na mesma transação do checkpoint. A correção continua visível; abrir o resultado não é requisito para salvar o avanço. Comandos repetidos não duplicam histórico nem revisões.
- Sessões incompletas só são retomadas pela ação principal quando correspondem à próxima etapa. Abrir uma aula já concluída sem intenção de revisão segue para a continuação; `revisao=1` permite repetir explicitamente, reaproveitando conteúdo salvo.
- As aulas geradas de um material são agrupadas em uma unidade/PDF, mantendo a ordem interna dos blocos existentes. Ao concluir, a continuação oferece a próxima unidade, preparar um material já enviado ou adicionar outro PDF.
- O upload e os geradores existentes são reaproveitados: enviar PDF → preparar trilha/tópicos → estudar. Gerar uma trilha novamente não apaga uma existente.
- A migration `0005_trail_material.sql` é aditiva. Associa tópicos antigos automaticamente apenas quando existe um único material na disciplina. Vínculos antigos ambíguos permanecem em “Conteúdo já cadastrado”, sem atribuição inventada nem exclusão de histórico.
- Conclusões históricas são consultadas sem janela de 100 sessões. Uma sessão antiga por tópico só equivale a uma microaula quando há exatamente uma microaula correspondente; não conclui várias aulas automaticamente.
- Diagnóstico não conclui unidades, revisões continuam disponíveis, e não foram adicionados FSRS ou um novo motor de domínio.

## Verificação

`pnpm test`, `pnpm typecheck`, `pnpm lint` e `pnpm build`.

Os testes usam PostgreSQL embutido (PGlite), dados sintéticos e as transações reais de gravação; não usam o banco publicado. Cobrem migração, propriedade dos dados, última resposta, duplicatas, 120 repetições, ordenação, PDF pendente e fim da sequência.

Para validação de aceitação, usar conta de teste: aula parcial → sair/retomar → última resposta → recarregar Trilha → próxima aula → fim do PDF → próximo PDF cadastrado/ausente → revisão sem regressão. Conferir 320, 360, 390 e 430 px e desktop. Não utilizar o histórico do aluno como fixture.
