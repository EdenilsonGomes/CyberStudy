# Contas na mesma aplicação

## Uso

- A conta original continua administradora e mantém todos os registros antigos.
- Perfil → Administrar contas e convites → informar e-mail → marcar “Nova conta para testes” quando apropriado → gerar e copiar o link.
- Convites duram 72 horas. O destinatário define nome e senha. Não existe cadastro público sem convite, nem senha padrão.
- Para testar sem encerrar sua sessão real, abra a conta de teste em outro perfil de navegador ou janela privada. Abas comuns compartilham o login.
- O amigo recebe seu próprio convite, sem marcar teste. Ele cadastra seus materiais; os seus não são copiados.
- Recuperação: administrador gera link de 30 minutos para uma conta existente e entrega em particular. Ainda não há SMTP, envio automático, verificação de e-mail ou recuperação autônoma do único administrador. Não divulgar links no chat público.
- Suspender uma conta preserva os dados e invalida suas sessões. Sair da conta também encerra todas as sessões dessa conta; trocar senha invalida cookies antigos.
- A marca TESTE é informativa: usa o mesmo código e provedor de IA e tem o mesmo custo por geração. Não é sandbox de infraestrutura nem autorização para alterar contas reais.

## Identidade e isolamento

`users.id` é o UUID interno estável. `auth_identities(provider, subject)` aponta para esse usuário. Atualmente o adaptador é local, com senha scrypt (N=32768, r=8, p=3, salt aleatório), cookies HttpOnly/Secure/Lax e limitação persistente de tentativas. Segredos não vão para componentes de cliente.

Os 18 conjuntos de dados de estudo possuem `user_id NOT NULL`. Consultas e mutações usam `getUserDb`, `owned` e `withOwner`, com testes que verificam todas as consultas existentes. Chaves estrangeiras compostas impedem referências entre contas mesmo em gravações. Cache de conteúdo e sessão ativa têm unicidade por conta. Administradores não recebem leitura privilegiada de estudos alheios.

Migração `0004_accounts.sql`: atribui todo o legado ao proprietário original, sem excluir/recriar material, diagnóstico, respostas ou histórico. O primeiro acesso associa esse proprietário a ADMIN_EMAIL e importa a senha existente uma única vez. Cookies antigos assinados só representam o proprietário na versão de sessão 1. Depois da importação, alterar ADMIN_PASSWORD não redefine sua senha local.

O executor de migrations existente mantém DDL e ledger na mesma transação protegida por advisory lock. As FKs compostas e índices de propriedade são definidos na migration SQL: não aplicar `drizzle-kit push` automaticamente em produção. A aplicação não usa Supabase RLS nesta fase e não deve expor o banco por API pública.

## Entrada futura do Supabase

1. Configurar o projeto e o adaptador de autenticação server-side; validar tokens no servidor (emissor, audiência, expiração e assinatura).
2. Associar o UUID verificado do Supabase a `auth_identities(provider='supabase', subject=...)`, preservando o `users.id` existente. Associação exige comprovação da conta ou migração administrativa auditada — nunca apenas coincidência de e-mail.
3. Alterar a resolução de identidade/sessão na camada de autenticação, não os IDs de aulas, material ou progresso. Testar acesso, renovação, recuperação e logout antes de desligar o adaptador local.
4. Não copiar hashes scrypt esperando que o Supabase os aceite. Planejar convite/redefinição de senha na transição e manter uma rota de recuperação do administrador.
5. Se o banco também migrar, transferir PostgreSQL preservando UUIDs/constraints; aplicar e testar RLS antes de habilitar qualquer acesso direto via cliente/Data API. Chaves service-role nunca no navegador.

Não há SDK, conexão, cobrança ou nova variável Supabase nesta entrega.

## Verificação e pendências

- Testes usam PostgreSQL embarcado (PGlite), somente como dependência de desenvolvimento: executam todas as migrations reais, preservação do legado, três identidades, convites/reutilização/expiração, senhas, limites, isolamento e FKs. Não acessam a base publicada.
- Testes estáticos impedem consultas novas sem filtro de propriedade no fluxo de estudo. Build/lint/typecheck continuam obrigatórios.
- Ativação de contas reais é pelo convite no produto. Teste browser de inscrição, login com senha, recuperação e suspensão requer as credenciais/ações do usuário, além dos testes automatizados.
- Sem reclassificação retroativa de sessões misturadas com testes: as sessões conhecidas também foram usadas pelo aluno. Preservadas até revisão explícita, sem reset geral.
- Continua pendente revisar perguntas ambíguas, repetidas e com respostas expostas, inclusive conteúdo já salvo; o isolamento de usuários não corrige a validade pedagógica desses resultados.
