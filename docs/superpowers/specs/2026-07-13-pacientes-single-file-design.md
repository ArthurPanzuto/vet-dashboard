# Consolidação em arquivo único + Redesenho de Pacientes (login por contexto, busca por tutor, prontuário em destaque)

Data: 2026-07-13

## Contexto

O DuoVet hoje é um app estático multi-arquivo (`index.html` + `css/styles.css` + `js/utils.js`, `js/state.js`, `js/charts.js`, `js/dashboard.js`, `js/form.js`, `js/services.js`, `js/despesas.js`, `js/historico.js`, `js/calendar.js`, `js/pacientes.js`, `js/relatorio.js`, `js/main.js`). A aba "Pacientes" já existe (busca por pet/tutor, ficha com dados cadastrais, timeline de consultas, cartão de vacinação com alertas) mas:

- Não há nenhuma barreira de acesso — qualquer pessoa que abra o navegador da clínica vê e edita prontuários.
- A busca é uma lista plana de pets; não há agrupamento por tutor nem indicação imediata de status crítico (internado/óbito).
- O layout da ficha dá o mesmo peso visual para cadastro, timeline e vacinação — não há uma área "nobre" dedicada ao prontuário clínico.
- Não existe histórico de peso ao longo do tempo (só um campo único de peso atual).

Este documento especifica: (1) a fusão de todo o projeto em um único `index.html` autocontido, e (2) o redesenho da aba Pacientes com login por contexto, busca centrada no tutor e um layout que dá destaque central ao quadro clínico.

## Decisões já validadas com o usuário

1. **Consolidação total**: todo o CSS e JS atuais passam a viver inline dentro de `index.html` (um `<style>` e uma sequência de `<script>`, um por módulo, na mesma ordem de dependência de hoje). Os arquivos `css/styles.css` e `js/*.js` deixam de ser referenciados pela página.
2. **Modelo de tutor**: sem entidade "Tutor" separada. Agrupamento de pacientes por tutor feito em memória, chaveado por CPF (fallback: nome do tutor em minúsculas) — sem migração de dados existentes.
3. **Veterinários/senhas**: geridos via uma lista em `localStorage`, semeada na primeira execução com uma lista padrão, editável por uma telinha simples (adicionar/remover). Sem segurança real — é uma barreira de contexto, não autenticação criptográfica.
4. **Sessão de login**: válida em memória (variável JS, não persistida) — dura enquanto a página não é recarregada. F5 ou fechar o navegador exige login de novo. Há botão "Trocar veterinário" para logout manual a qualquer momento.

## Arquitetura

`index.html` passa a conter, nesta ordem, dentro do `<head>`/`<body>`:

1. `<head>`: mesmos CDNs de hoje (Chart.js, Tabler Icons, jsPDF, jspdf-autotable) + um único bloco `<style>` com todo o CSS consolidado (conteúdo atual de `css/styles.css` + as adições desta spec).
2. `<body>`: o markup atual (nav, seções de cada aba, modais, toast) + as adições desta spec (overlay de login, modal de gerenciar veterinários, novo layout da ficha de paciente).
3. Antes do `</body>`: uma sequência de `<script>...</script>` — um bloco por módulo, exatamente na ordem de dependência atual (`utils, state, charts, dashboard, form, services, despesas, historico, calendar, pacientes, relatorio`), **mais um novo módulo `auth`** inserido logo após `state` (depende de `utils`/`state`, e é usado por `main` e por `pacientes`), e por fim `main`.

Cada bloco `<script>` mantém o mesmo conteúdo/IIFE que o arquivo `.js` correspondente tem hoje (com os ajustes descritos abaixo). Isso é uma migração mecânica de baixo risco: scripts em tags separadas executam em sequência exatamente como arquivos `<script src>` separados executavam.

Os arquivos `css/styles.css` e `js/*.js` ficam sem uso após a migração (não são apagados neste plano — decisão de limpeza fica para depois, se o usuário quiser).

## Novo módulo: `DuoVet.auth`

Responsável pela lista de veterinários e pela sessão de login. Não é chamado de nenhum outro módulo além de `main` (gate de navegação) e `pacientes` (nome do logado + botão logout).

**Dados** (`localStorage["duovet-vets-v1"]`, semeado na primeira execução):
```js
[
  { id, nome: "Dr. Antonio", senha: "1234" },
  { id, nome: "Dra. Iara",   senha: "1234" },
  { id, nome: "Dr. Nag",     senha: "1234" },
]
```

**API**:
- `getVets()` / `addVet({nome, senha})` / `removeVet(id)` — persistem em `localStorage` (padrão simples de `load()`/`persist()`, sem pub/sub — não precisa reatividade em outras telas).
- `login(vetId, senha)` → valida contra a lista; se ok, guarda `{ id, nome }` numa variável de módulo (`sessionVet`, só em memória) e retorna `true`; senão retorna `false`.
- `logout()` → limpa `sessionVet`.
- `isLoggedIn()` / `getSessionVet()`.
- `init()` — liga os handlers do overlay de login e do modal de gerenciar veterinários.

**UI**:
- `#auth-overlay` (tela cheia, `position:fixed`, acima de tudo): título "Identificação do Veterinário", `<select>` com os nomes (`getVets()`), campo de senha, botão "Entrar", mensagem de erro inline se senha errada, e um link menor "Gerenciar veterinários" que abre `#modal-gerenciar-vets` (lista com botão remover + formulário nome/senha para adicionar).
- Transição suave (fade/scale via CSS `transition`) ao abrir/fechar o overlay, consistente com os modais existentes do app.

## Gate de navegação (mudança em `main.js`)

Em `initNav()`, o clique no botão `.nav-btn[data-tab="pacientes"]` passa a ter um tratamento especial:

```js
if (target === "pacientes" && !DuoVet.auth.isLoggedIn()) {
  DuoVet.auth.openLoginOverlay(() => switchTab("pacientes"));
  return; // não troca de aba ainda
}
switchTab(target);
```

`openLoginOverlay(onSuccess)` mostra o overlay; se o login for concluído com sucesso, chama `onSuccess()` (que troca de fato para a aba Pacientes) e fecha o overlay. Se o usuário fechar o overlay sem logar, permanece na aba atual.

Dentro da aba Pacientes, o cabeçalho passa a mostrar "Logado: {nome}" + botão "Trocar veterinário", que chama `DuoVet.auth.logout()` e reabre o overlay imediatamente (sem trocar de aba — a aba Pacientes fica "bloqueada" visualmente atrás do overlay até novo login).

## Modelo de dados (mudanças em `state.js`)

Dois campos novos, sem quebrar dados salvos existentes (`load()` já tolera campos ausentes com fallback):

- `patient.internado: boolean` (default `false` em `addPatient`).
- `patient.obito: boolean` (default `false` em `addPatient`).
- `consulta.peso: number | null` (opcional, default `null` em `addConsulta`) — é o mecanismo de "histórico de peso": cada consulta pode registrar o peso do pet naquele dia.

Novas funções em `state.js`:
- `toggleInternado(patientId)` / `toggleObito(patientId)` — leem o valor atual e invertem, chamando `notify()`. Usadas pelos badges clicáveis (toggle rápido, sem abrir modal).

`load()`/`persist()` não precisam de tratamento especial adicional para os dois booleans (já são serializáveis via JSON como estão); `consulta.peso` também não precisa revive especial (é `number`/`null`, não `Date`).

## Busca e agrupamento por tutor (mudanças em `pacientes.js`)

- Novo estado local `searchMode: "tutor" | "pet"` (default `"tutor"`), alternado por um pill/segmented control ao lado do campo de busca.
- `groupKey(patient)` → `patient.tutorCpf.trim() || patient.tutorNome.trim().toLowerCase()`.
- `filteredGroups()`:
  1. Filtra `getPatients()` pelo termo — contra `tutorNome` se `searchMode === "tutor"` (mais o CPF, tratado como "código"), ou contra `nomePet` se `searchMode === "pet"`.
  2. Agrupa os pacientes filtrados por `groupKey`, mas ao montar cada grupo busca **todos** os pacientes daquele mesmo tutor (não só os que bateram no filtro) — é isso que garante "assim que o cliente é selecionado, lista automaticamente todos os animais vinculados".
  3. Retorna `[{ tutorNome, tutorCpf, pets: Patient[] }]`.
- `renderSearchResults()` passa a renderizar um card por tutor (nome, "código" = últimos 4 dígitos do CPF quando houver, senão "—") com chips de pets dentro do card (nome do pet + bolinha de status: vermelha = Óbito, âmbar = Internado, ausente = normal). Clicar num chip de pet chama `openFicha(petId)` como hoje.

## Layout da ficha (mudanças em `pacientes.js` + `index.html` + CSS)

`#pacientes-ficha` passa de `.g2` (cadastro | coluna com última-visita+consultas+vacinação) para um grid de 2 colunas explícito `.pac-ficha-layout` (`grid-template-columns: 280px 1fr`):

- **Coluna esquerda (`#pac-sidebar`)**: card fixo com nome/telefone/CPF do tutor + lista vertical dos pets dele (`#pac-tutor-pets`) — cada item é um botão com nome do pet, espécie, e os mesmos indicadores de status (Internado/Óbito); o pet ativo fica destacado (`.active`). Clicar em outro pet troca `activePatientId` e re-renderiza a ficha sem sair da tela (mesmo tutor).
- **Coluna direita**: a área "nobre", mais larga —
  1. Cabeçalho do prontuário: nome do pet + badges clicáveis "Internado" / "Óbito" (toggle direto via `DuoVet.state.toggleInternado/toggleObito`, com confirmação simples via `confirm()` para Óbito por ser irreversível na prática clínica) + dados cadastrais (espécie/raça/idade/peso/sexo) + botão "Editar".
  2. "Última vez que veio" (like hoje).
  3. Mini sparkline de histórico de peso (barras CSS simples, sem lib nova) — renderizada só quando há ≥ 2 consultas com `peso` preenchido, usando os valores em ordem cronológica.
  4. Timeline de consultas (como hoje, mas cada item mostra o peso registrado naquela consulta quando presente).
  5. Cartão de vacinação (alertas + tabela), abaixo da timeline — mesma lógica atual, só reposicionado como bloco secundário.

O modal "Novo/Editar Paciente" ganha dois checkboxes (Internado / Óbito) para definição inicial; o modal "Registrar Nova Consulta" ganha um campo numérico opcional "Peso (kg)".

## CSS (novas seções, mantendo os design tokens existentes)

- `#auth-overlay` + `.auth-box`: overlay full-screen com fundo escurecido (`rgba(0,0,0,.55)`) e um card central, mesma linguagem visual dos modais atuais; transições de opacidade/escala.
- `.tutor-card`, `.tutor-pets-chips`, `.status-dot` (`.status-dot--obito` vermelho, `.status-dot--internado` âmbar).
- `.pac-ficha-layout` (grid 280px/1fr, colapsando para 1 coluna em telas estreitas via media query, seguindo o padrão já usado em `.g2`).
- `.pac-sidebar-pet` (`.active` com borda/fundo destacado).
- `.status-badge` clicável (estilo pill, cores reaproveitando `--red`/`--red-l` e `--amber`/`--amber-l` já existentes).
- `.weight-sparkline` (barras via `<div>` com `height` proporcional, `display:flex;align-items:flex-end;gap:2px`).

## Fora de escopo

- Sincronização entre dispositivos/navegadores (continua sendo só `localStorage` local).
- Segurança real de senha (hash, rate-limit, etc.) — é deliberadamente só uma barreira de contexto.
- Entidade "Tutor" com cadastro/edição própria — permanece implícita via agrupamento por CPF/nome.
- Edição do peso retroativo em consultas antigas fora do fluxo normal de edição de consulta (não há tela dedicada de "editar histórico de peso").
