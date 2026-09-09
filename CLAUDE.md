# DuoVet — contexto do projeto para o Claude Code

Este arquivo é lido automaticamente pelo Claude Code sempre que você abre uma
sessão dentro desta pasta. Mantenha-o atualizado conforme o projeto evolui —
é a forma de levar contexto entre máquinas/sessões sem precisar reexplicar
tudo do zero.

## O que é o DuoVet

App de gestão para clínica veterinária (pacientes, financeiro, agenda,
catálogo/estoque, banho e tosa, mensagens WhatsApp). Single-page app em um
único arquivo HTML — sem build, sem npm, sem framework de frontend. Backend:
Firebase (Auth + Firestore + Cloud Functions).

- **Produção**: `index.html`, publicado via GitHub Pages em
  `https://arthurpanzuto.github.io/vet-dashboard/` a cada `git push` na
  branch `main`.
- **Beta/desenvolvimento**: `index-beta.html`, na branch
  `feature/dashboard-redesign`. Todo trabalho novo começa aqui.
- Repositório: `https://github.com/ArthurPanzuto/vet-dashboard` (branch
  `main` = produção real).
- Projeto Firebase: `dashboard-duovet` (mesmo projeto para Beta e produção
  — os dois arquivos apontam para o mesmo `firebaseConfig`/banco real).

## Fluxo de trabalho estabelecido (importante seguir)

1. **Toda mudança nova é feita primeiro em `index-beta.html`**, nunca direto
   em `index.html`. Testar ali antes de qualquer promoção pra produção.
2. **Nunca simular uma integração.** Se algo não pode funcionar de verdade
   ainda (falta credencial, aprovação externa, etc.), o estado da UI deve
   refletir isso honestamente (ex: "Em breve", botão escondido) — nunca um
   botão que finge funcionar.
3. **Nunca inventar credenciais, IDs ou tokens.** Se uma integração externa
   precisa de algo (Client ID do Google, App ID da Meta, etc.), diga
   exatamente o que é necessário e onde obter — nunca preencher com valor
   fictício.
4. **Antes de promover Beta → produção**: rodar a suíte de testes (ver
   seção Testes abaixo) contra o `index.html` real antes de comitar, depois
   comitar/push, esperar o GitHub Pages propagar, e reexecutar a mesma
   suíte contra a URL ao vivo. Só então considerar a etapa concluída.
5. **Nunca fazer `git push` para `main` sem confirmação explícita do
   usuário** — é o passo que efetivamente publica no site real.
6. **Confirmar antes de alterar dados em produção** (Firestore real) — o
   banco de produção guarda dados reais de clínica; qualquer escrita de
   teste feita contra ele deve ser limpa depois.
7. Ao terminar uma tarefa que mexeu em código, sempre confirmar zero erros
   de JavaScript antes de reportar como concluído (ver seção Testes).

## Arquitetura de dados (Firestore) — já multi-tenant

Isso já foi decidido e implementado: o DuoVet é estruturalmente
multi-tenant, pronto para várias clínicas sem precisar de projeto/banco
separado por cliente.

- Todo dado fica em `organizations/{orgId}/{colecao}/{doc}` — nunca solto
  na raiz. A função central é `orgCollection(name)` em `state.js` (dentro
  do HTML), que monta esse caminho sozinha.
- `users/{uid}` guarda `{ nome, email, orgId }` — de qual organização cada
  usuário é membro.
- `organizations/{orgId}/allowlist/{email}` — controla quem pode criar
  conta vinculada àquela organização (ver `firestore.rules`,
  função `isMember(orgId)`).
- **Regras do Firestore listam cada coleção explicitamente** (não usam
  wildcard recursivo `/{document=**}`) — isso é proposital, para evitar
  vazamento via avaliação em OR das regras. Qualquer coleção nova precisa
  de uma linha própria em `firestore.rules`.
- Adicionar uma clínica nova hoje = processo manual no Firebase Console
  (criar `organizations/{orgId}` + allowlist) — funcional, mas não
  self-service ainda. Ver seção "Roadmap comercial" abaixo.

## Testes (sempre headless Chrome via CDP, nunca "confiar no código")

Não há suíte de testes formal (Jest/Playwright) neste projeto — a prática
estabelecida é escrever scripts Node.js ad-hoc que abrem o `index.html`/
`index-beta.html` num Chrome headless via Chrome DevTools Protocol (CDP),
fazem login com o usuário de teste, executam ações reais na UI e verificam
o resultado programaticamente. Scripts ficam no diretório de scratchpad da
sessão (temporário) — não fazem parte do repositório.

Padrão usado:
```js
spawn(CHROME, ["--headless=new", "--remote-debugging-port=PORT", `--user-data-dir=PROFILE`, URL]);
// WebSocket na target.webSocketDebuggerUrl, Runtime.evaluate para interagir/verificar,
// captura Runtime.exceptionThrown para garantir zero erros de JS.
```
Login de teste: email `ai.workbech@gmail.com`, senha `senha123456`, código
de organização `duovet`.

Regra de ouro: sempre rodar os scripts em sequência (nunca em paralelo) —
rodar vários Chromes headless ao mesmo tempo já causou falsos negativos por
disputa de recursos.

## Status atual das integrações (Configurações → Integrações)

- **Google Calendar**: implementação real e completa (OAuth via
  `google.accounts.oauth2`), só falta o usuário gerar um Client ID no
  Google Cloud Console e colar em `GOOGLE_CALENDAR_CLIENT_ID` (constante
  no `<head>` do HTML). Enquanto for `null`, o card mostra "Não
  configurado" sem botão — proposital.
- **WhatsApp Business**: arquitetura multi-tenant via **Meta Embedded
  Signup** já implementada de ponta a ponta (frontend + Cloud Functions +
  regras do Firestore) — mas ainda não publicada/ativa, porque falta o App
  da Meta ter o Embedded Signup aprovado (processo externo, fora do nosso
  controle, pode levar dias/semanas). Enquanto isso, o card mostra "Em
  breve" com um botão "Ver tutorial" (linguagem simples, para o
  funcionário da clínica — não para desenvolvedor). Passo a passo técnico
  completo (para quem administra o projeto) está no `README.md`.
- As duas integrações são **independentes entre si** — conectar uma nunca
  afeta a outra (IDs de elemento e módulos JS totalmente separados).

## Estrutura da dashboard (visão rápida)

- **Configurações** tem sub-abas: Perfil, Aparência, Integrações, API e
  Webhooks, Módulos.
- **Perfil**: dados do usuário logado (somente leitura hoje — editar nome
  exigiria mudar a regra `users/{uid}: allow update: if false`, decisão
  deliberada de segurança, não fazer sem avaliar o impacto) + botão de
  encerrar sessão.
- **Aparência**: tema (claro/escuro/sistema), densidade, tamanho de texto,
  barra lateral expandida/recolhida.
- Barra de ações rápidas no topo (busca de funcionalidades, atalho de
  tema, central de notificações reais — calculadas a partir de dados já
  existentes: despesas a vencer, estoque baixo, agenda do dia,
  pagamentos do dia — nunca notificação fictícia).
- Módulos opcionais (Banho e Tosa, WhatsApp, Produtos, Farmácia) podem ser
  ativados/desativados por organização em Configurações → Módulos.

## Roadmap comercial discutido (ainda não implementado)

O usuário quer transformar o DuoVet num SaaS multi-clínicas de verdade.
Decisões já tomadas nessa conversa (não implementar sem revisitar o
contexto completo):

- **Não** duplicar projeto/banco por clínica — a arquitetura atual
  (`organizations/{orgId}`) já resolve isso.
- **Não** migrar de Firestore para Supabase — sem ganho real, custo alto
  de reescrita.
- **Sim**, dá pra trocar a hospedagem de GitHub Pages para Netlify (ou
  outro) sem nenhum impacto na arquitetura de dados — são decisões
  independentes.
- O que falta de verdade pra virar produto comercial: onboarding
  automatizado de clínica nova (hoje é manual no Console), painel de
  super-admin, cobrança (Stripe), e resolver o WhatsApp por clínica
  (depende da aprovação do Embedded Signup, ver acima).

## Outras branches no repositório

Além de `main` e `feature/dashboard-redesign`, existem
`feature/dynamic-org-name`, `feature/instagram-tab` e
`feature/patient-photos` — trabalho de outras sessões/contextos, não
necessariamente relacionado ao histórico acima. Verificar o conteúdo antes
de assumir o que contêm.

## Mantendo este arquivo atualizado

Sempre que uma decisão arquitetural importante for tomada, um padrão novo
for estabelecido, ou uma integração mudar de status, atualize este
`CLAUDE.md` (é só pedir: "atualiza o CLAUDE.md com X") e comite a mudança
como qualquer outro arquivo do projeto — assim ele viaja com o repositório
para qualquer máquina que o clonar.
