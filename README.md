# CyberStudy

Aplicação pessoal para transformar conteúdos de Segurança da Informação em estudo ativo: registrar dúvidas com as próprias palavras, conversar com um tutor, gerar quizzes, acompanhar assuntos fracos, programar revisões e montar um plano SOS para provas.

## Stack

- Next.js 16, App Router e TypeScript
- Tailwind CSS
- PostgreSQL com Drizzle ORM
- OpenAI Responses API
- Mistral API opcional para organizar materiais em tópicos
- Docker (um único container da aplicação)

## Rodar localmente

Requisitos: Node.js 22+, pnpm e PostgreSQL.

1. Copie `.env.example` para `.env.local` e preencha as variáveis.
2. Execute `pnpm install`.
3. Execute `pnpm db:migrate`.
4. Execute `pnpm dev` e acesse `http://localhost:3000`.

O login usa `ADMIN_EMAIL` e `ADMIN_PASSWORD`. Não existe cadastro público nesta V0.

## Variáveis

| Variável | Obrigatória | Uso |
|---|---:|---|
| `DATABASE_URL` | sim | Conexão PostgreSQL |
| `OPENAI_API_KEY` | para IA | Tutor, quiz e teste de entendimento |
| `OPENAI_MODEL` | não | Modelo configurável; padrão `gpt-5-mini` |
| `MISTRAL_API_KEY` | não | Alternativa para organizar materiais em tópicos |
| `MISTRAL_MODEL` | não | Modelo Mistral; padrão `mistral-small-latest` |
| `ADMIN_EMAIL` | sim | Login único da V0 |
| `ADMIN_PASSWORD` | sim | Login e assinatura da sessão quando `AUTH_SECRET` não existe |
| `AUTH_SECRET` | recomendado | Segredo longo para assinar a sessão |
| `NEXT_PUBLIC_APP_NAME` | não | Nome público da aplicação |
| `NODE_ENV` | sim em produção | Use `production` |
| `PORT` | não | Porta HTTP; padrão 3000 |

Para trocar o modelo principal, altere somente `OPENAI_MODEL`. Se a OpenAI não estiver configurada, a organização de materiais pode usar `MISTRAL_API_KEY`. As chamadas estão centralizadas em `src/lib/ai.ts`, usam contexto curto e resposta limitada. Cada ação dispara no máximo uma chamada de IA; a correção de quizzes e o plano SOS são locais.

## Banco e migrations

O schema está em `src/db/schema.ts`. A migration inicial fica em `migrations/0000_initial.sql`.

```sh
pnpm db:migrate
```

O container também executa a migration automaticamente antes de iniciar. Os arquivos PDF não são persistidos: apenas o texto extraído e seus chunks ficam no PostgreSQL.

## Docker

```sh
docker build -t cyberstudy .
docker run --rm -p 3000:3000 --env-file .env cyberstudy
```

O health check está em `GET /api/health` e responde `{ "status": "ok" }`.

## Deploy no EasyPanel

1. Crie um serviço PostgreSQL e copie a URL interna de conexão.
2. Crie um serviço App usando este repositório e o `Dockerfile` da raiz.
3. Cadastre todas as variáveis da tabela acima. Use uma senha e um `AUTH_SECRET` fortes.
4. Configure a porta do serviço como `3000` (ou o mesmo valor de `PORT`).
5. Configure o health check como `/api/health`.
6. Faça o deploy. A migration roda automaticamente no início do container.
7. Aponte o domínio e mantenha HTTPS ativo; o cookie de sessão é `secure` em produção.

Não configure volume para uploads: o estado durável está no PostgreSQL.

## Estrutura

- `src/app/(app)`: páginas autenticadas
- `src/app/actions.ts`: operações do servidor
- `src/app/api`: login, logout, materiais e saúde
- `src/db`: conexão e schema
- `src/lib/ai.ts`: integração única de IA
- `migrations`: SQL versionado
- `scripts/migrate.mjs`: executor pequeno de migrations

## Verificação

```sh
pnpm lint
pnpm typecheck
pnpm build
```
