# Consolidação em Arquivo Único + Redesenho de Pacientes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fundir todo o projeto DuoVet (hoje `index.html` + `css/styles.css` + 12 arquivos `js/*.js`) em um único `index.html` autocontido, e redesenhar a aba "Pacientes" com login por contexto (por veterinário), busca centrada no tutor com agrupamento automático de pets, status críticos (Internado/Óbito) em destaque, e um layout que dá espaço nobre ao prontuário clínico com histórico de peso.

**Architecture:** O app continua sendo 100% estático (sem build step, sem backend). Cada módulo JS continua sendo uma IIFE isolada pendurada em `window.DuoVet`, só que agora vive num bloco `<script>` dentro do próprio `index.html` em vez de um arquivo `.js` externo — a ordem de execução (que hoje depende da ordem das tags `<script src>`) é preservada exatamente, só trocando `src="js/x.js"` por conteúdo inline. Um novo módulo `DuoVet.auth` (lista de veterinários + sessão de login em memória) se insere nessa mesma cadeia. As mudanças de dados (`internado`, `obito`, `peso` da consulta) são campos novos e opcionais no mesmo `patients` array de sempre — sem migração, sem quebrar dados já salvos em `localStorage["duovet-data-v1"]`.

**Tech Stack:** HTML/CSS/JS puro (sem framework, sem bundler). CDNs já usados no projeto (Chart.js, Tabler Icons, jsPDF, jspdf-autotable) continuam como estão — nenhuma dependência nova é introduzida.

## Global Constraints

- Arquivo final: **um único `index.html`** contendo `<style>` (todo o CSS) e uma sequência de `<script>` (um por módulo) — nada de `<link rel="stylesheet" href="css/...">` nem `<script src="js/...">` sobrevive no HTML final.
- Nenhuma dependência nova além das já carregadas via CDN hoje (Chart.js 4.4.4, Tabler Icons 3.30.0, jsPDF 2.5.1, jspdf-autotable 3.8.2).
- Manter o padrão de módulo existente: cada módulo é `DuoVet.<nome> = (function () { ...; return {...}; })();`.
- Este projeto **não tem framework de teste** (sem Jest/pytest). A verificação estabelecida na sessão é: (1) abrir o Chrome headless via CDP (Chrome DevTools Protocol) usando `WebSocket`/`fetch` nativos do Node — sem Playwright/Puppeteer — carregando `file:///.../index.html`; (2) usar `Runtime.evaluate` para inspecionar `DuoVet.*` e disparar cliques/preenchimentos; (3) checar ausência de `Runtime.exceptionThrown`/`console.error`; (4) `Page.captureScreenshot` para conferência visual. Cada task abaixo tem um passo "Verificar via CDP" que substitui o `pytest`/`jest` de um projeto com framework de testes. Scripts de verificação vão para o diretório de scratchpad da sessão (não fazem parte do repositório).
- `localStorage["duovet-data-v1"]` (dados clínicos/financeiros) mantém a mesma chave e formato, só ganhando campos novos opcionais. Novo `localStorage["duovet-vets-v1"]` só para a lista de veterinários/senhas.
- Tema (dark/light via `:root[data-theme="light"]`) deve ser respeitado em todo CSS novo — usar os tokens existentes (`--bg`, `--card`, `--t1`, `--blue`/`-l`, `--red`/`-l`, `--amber`/`-l`, `--border`, etc.), nunca cores hex fixas soltas no HTML/CSS novo.
- Sessão de login (`DuoVet.auth`) vive **só em memória** (variável de módulo) — nunca é persistida em `localStorage`; recarregar a página sempre exige novo login.

---

## File Structure

Um único arquivo é tocado em (quase) todas as tasks:

- **Modifica:** `C:\Users\tpanz\vet-dashboard\index.html` — cresce de 575 linhas para um arquivo único contendo todo `<style>` + markup + todos os `<script>`.
- **Fica órfão (não referenciado, não apagado neste plano):** `css/styles.css`, `js/utils.js`, `js/state.js`, `js/charts.js`, `js/dashboard.js`, `js/form.js`, `js/services.js`, `js/despesas.js`, `js/historico.js`, `js/calendar.js`, `js/pacientes.js`, `js/relatorio.js`, `js/main.js`.
- **Scripts de verificação (fora do repo):** `<scratchpad>/verify-task-N.mjs` — um por task, seguindo o padrão CDP já estabelecido na sessão (ver Global Constraints).

---

### Task 1: Inlinar o CSS

**Files:**
- Modify: `C:\Users\tpanz\vet-dashboard\index.html` (linha 29: `<link rel="stylesheet" href="css/styles.css" />`)
- Read: `C:\Users\tpanz\vet-dashboard\css\styles.css` (338 linhas, fonte da verdade — copiar o conteúdo literal, não retranscrever à mão)

**Interfaces:**
- Produces: um bloco `<style id="duovet-styles">...</style>` no `<head>`, contendo o texto integral e inalterado de `css/styles.css`.

- [ ] **Step 1: Ler `css/styles.css` por completo**

Usar a ferramenta de leitura de arquivo para obter o conteúdo integral (338 linhas).

- [ ] **Step 2: Substituir a tag `<link>` por `<style>` com o conteúdo colado**

Em `index.html`, trocar exatamente:
```html
  <link rel="stylesheet" href="css/styles.css" />
```
por:
```html
  <style id="duovet-styles">
/* ...conteúdo integral e literal de css/styles.css colado aqui, sem alterar uma linha... */
  </style>
```

- [ ] **Step 3: Verificar via CDP que o visual não mudou**

Criar `<scratchpad>/verify-task-1.mjs` seguindo o padrão CDP da sessão (spawn do Chrome com `--headless=new --remote-debugging-port=PORT --user-data-dir=<profile-temporário>`, conectar via `WebSocket` ao `webSocketDebuggerUrl`, `Page.enable`/`Runtime.enable`). Navegar para `file:///C:/Users/tpanz/vet-dashboard/index.html`, tirar um `Page.captureScreenshot` da aba "Painel" (aba ativa por padrão) e confirmar visualmente (abrindo o PNG) que o layout é idêntico ao estado atual do app (cores, cards, fontes). Confirmar também `errors.length === 0` (nenhum `Runtime.exceptionThrown`/`console.error`).

Rodar: `node <scratchpad>/verify-task-1.mjs`
Esperado: screenshot idêntico ao app atual, zero erros de console.

- [ ] **Step 4: Commit**

Este projeto não é um repositório git (confirmado: `git status` em `C:\Users\tpanz\vet-dashboard` retorna "not a git repository"). Pular commit — apenas seguir para a próxima task.

---

### Task 2: Inlinar todo o JavaScript

**Files:**
- Modify: `C:\Users\tpanz\vet-dashboard\index.html` (linhas 560–574: bloco de `<script src="js/...">`)
- Read (nesta ordem exata — é a ordem de dependência atual): `js/utils.js` (128 linhas), `js/state.js` (271 linhas), `js/charts.js` (299 linhas), `js/dashboard.js` (224 linhas), `js/form.js` (100 linhas), `js/services.js` (110 linhas), `js/despesas.js` (109 linhas), `js/historico.js` (53 linhas), `js/calendar.js` (269 linhas), `js/pacientes.js` (373 linhas), `js/relatorio.js` (285 linhas), `js/main.js` (98 linhas)

**Interfaces:**
- Consumes: nenhuma (mecânica, os módulos já existem prontos).
- Produces: 12 blocos `<script>` sequenciais no `<body>`, cada um com o conteúdo literal do `.js` correspondente, na mesma ordem. `window.DuoVet.utils`, `.state`, `.charts`, `.dashboard`, `.form`, `.servicesView`, `.despesas`, `.historico`, `.calendar`, `.pacientes`, `.relatorio` continuam existindo com as mesmas APIs que as tasks seguintes vão consumir.

- [ ] **Step 1: Ler os 12 arquivos `.js` na ordem listada acima**

- [ ] **Step 2: Substituir o bloco de `<script src>` por 12 blocos inline**

Em `index.html`, trocar exatamente (linhas 560–574):
```html
  <!-- Ordem importa: cada arquivo se registra em window.DuoVet; state.js
       depende de utils.js já ter rodado, os demais dependem de state.js. -->
  <script src="js/utils.js"></script>
  <script src="js/state.js"></script>
  <script src="js/charts.js"></script>
  <script src="js/dashboard.js"></script>
  <script src="js/form.js"></script>
  <script src="js/services.js"></script>
  <script src="js/despesas.js"></script>
  <script src="js/historico.js"></script>
  <script src="js/calendar.js"></script>
  <script src="js/pacientes.js"></script>
  <script src="js/relatorio.js"></script>
  <script src="js/main.js"></script>
</body>
```
por:
```html
  <!-- Ordem importa: cada bloco se registra em window.DuoVet; state
       depende de utils já ter rodado, os demais dependem de state. -->
  <script>
/* ...conteúdo integral e literal de js/utils.js... */
  </script>
  <script>
/* ...conteúdo integral e literal de js/state.js... */
  </script>
  <script>
/* ...conteúdo integral e literal de js/charts.js... */
  </script>
  <script>
/* ...conteúdo integral e literal de js/dashboard.js... */
  </script>
  <script>
/* ...conteúdo integral e literal de js/form.js... */
  </script>
  <script>
/* ...conteúdo integral e literal de js/services.js... */
  </script>
  <script>
/* ...conteúdo integral e literal de js/despesas.js... */
  </script>
  <script>
/* ...conteúdo integral e literal de js/historico.js... */
  </script>
  <script>
/* ...conteúdo integral e literal de js/calendar.js... */
  </script>
  <script>
/* ...conteúdo integral e literal de js/pacientes.js... */
  </script>
  <script>
/* ...conteúdo integral e literal de js/relatorio.js... */
  </script>
  <script>
/* ...conteúdo integral e literal de js/main.js... */
  </script>
</body>
```

- [ ] **Step 3: `node --check` em cada arquivo original antes de colar (garantia extra de sintaxe válida)**

Rodar: `node --check js/utils.js && node --check js/state.js && node --check js/charts.js && node --check js/dashboard.js && node --check js/form.js && node --check js/services.js && node --check js/despesas.js && node --check js/historico.js && node --check js/calendar.js && node --check js/pacientes.js && node --check js/relatorio.js && node --check js/main.js`
Esperado: nenhuma saída (sintaxe válida em todos).

- [ ] **Step 4: Verificar via CDP que o app inteiro funciona igual a antes**

Criar `<scratchpad>/verify-task-2.mjs` (padrão CDP da sessão). Com um `user-data-dir` limpo (localStorage vazio):
1. Navegar para o `index.html` consolidado.
2. Confirmar via `Runtime.evaluate`: `typeof window.DuoVet.state.getPatients === "function"` e o mesmo para `.dashboard.render`, `.calendar.render`, `.relatorio.gerarPDF` (checar só a existência, não chamar ainda).
3. Clicar em cada botão de aba (`.nav-btn[data-tab]`) para `dashboard, venda, servicos, gastos, historico, calendario` (pular `pacientes` — ainda não tem login nesta task) e confirmar, a cada clique, que a seção correspondente ganha `.active` e não há novos erros de console.
4. Preencher e submeter o formulário de Nova Venda com um valor simples; confirmar via `DuoVet.state.getTransactions().length` que incrementou.
5. Confirmar `errors.length === 0` ao final.

Rodar: `node <scratchpad>/verify-task-2.mjs`
Esperado: todas as asserções acima passam, zero erros de console.

- [ ] **Step 5: Commit**

Sem git neste projeto — pular.

---

### Task 3: Módulo `DuoVet.auth` (lista de veterinários + sessão de login)

**Files:**
- Modify: `C:\Users\tpanz\vet-dashboard\index.html` — inserir um novo bloco `<script>` logo após o bloco de `state` (inserido na Task 2) e antes do bloco de `charts`.

**Interfaces:**
- Consumes: `DuoVet.utils.generateId()` (já existe em `utils.js`).
- Produces (consumido pela Task 4 em diante):
  - `DuoVet.auth.getVets()` → `Array<{id: string, nome: string, senha: string}>`
  - `DuoVet.auth.addVet({nome, senha})` → `void`
  - `DuoVet.auth.removeVet(id)` → `void`
  - `DuoVet.auth.login(vetId, senha)` → `boolean`
  - `DuoVet.auth.logout()` → `void`
  - `DuoVet.auth.isLoggedIn()` → `boolean`
  - `DuoVet.auth.getSessionVet()` → `{id, nome} | null`

- [ ] **Step 1: Escrever o módulo**

Inserir este bloco `<script>` completo em `index.html`, imediatamente depois do bloco inline de `state` e antes do bloco inline de `charts` (ambos inseridos na Task 2):

```html
  <script>
// auth.js — barreira de contexto para a aba Pacientes: cada veterinário se
// identifica antes de ver/editar prontuários. Não é segurança real (não há
// backend), é só uma barreira para evitar edição acidental por quem não é o
// profissional responsável. Lista de veterinários/senhas persiste em
// localStorage separado dos dados clínicos; a sessão de login em si NUNCA é
// persistida — vive só em memória e some ao recarregar a página.
window.DuoVet = window.DuoVet || {};

DuoVet.auth = (function () {
  const { generateId } = DuoVet.utils;
  const STORAGE_KEY = "duovet-vets-v1";

  let vets = [
    { id: generateId(), nome: "Dr. Antonio", senha: "1234" },
    { id: generateId(), nome: "Dra. Iara", senha: "1234" },
    { id: generateId(), nome: "Dr. Nag", senha: "1234" },
  ];
  let sessionVet = null; // { id, nome } | null — só em memória, nunca persiste

  function load() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return;
    }
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved) && saved.length) vets = saved;
    } catch (e) {
      console.error("DuoVet: lista de veterinários corrompida, usando padrão.", e);
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vets));
    } catch (e) {
      console.error("DuoVet: não foi possível salvar a lista de veterinários.", e);
    }
  }

  load();

  function getVets() {
    return vets.slice();
  }

  function addVet(entry) {
    vets.push({ id: generateId(), ...entry });
    persist();
  }

  function removeVet(id) {
    vets = vets.filter((v) => v.id !== id);
    persist();
  }

  function login(vetId, senha) {
    const vet = vets.find((v) => v.id === vetId);
    if (!vet || vet.senha !== senha) return false;
    sessionVet = { id: vet.id, nome: vet.nome };
    return true;
  }

  function logout() {
    sessionVet = null;
  }

  function isLoggedIn() {
    return sessionVet !== null;
  }

  function getSessionVet() {
    return sessionVet;
  }

  return { getVets, addVet, removeVet, login, logout, isLoggedIn, getSessionVet };
})();
  </script>
```

- [ ] **Step 2: Verificar via CDP**

Criar `<scratchpad>/verify-task-3.mjs`. Com `localStorage` limpo, via `Runtime.evaluate`:
1. `DuoVet.auth.getVets().length === 3` e os nomes são `["Dr. Antonio", "Dra. Iara", "Dr. Nag"]`.
2. `DuoVet.auth.isLoggedIn() === false`.
3. `DuoVet.auth.login("id-invalido", "1234") === false`.
4. Pegar `const vets = DuoVet.auth.getVets(); DuoVet.auth.login(vets[0].id, "senha-errada") === false`.
5. `DuoVet.auth.login(vets[0].id, "1234") === true`, e depois `DuoVet.auth.isLoggedIn() === true` e `DuoVet.auth.getSessionVet().nome === "Dr. Antonio"`.
6. `DuoVet.auth.logout()`; `DuoVet.auth.isLoggedIn() === false`.
7. `DuoVet.auth.addVet({nome:"Dr. Teste", senha:"9999"})`; `DuoVet.auth.getVets().length === 4`; recarregar a página (nova navegação `Page.navigate` na mesma aba) e confirmar que `DuoVet.auth.getVets().length === 4` ainda (persistiu no localStorage).

Rodar: `node <scratchpad>/verify-task-3.mjs`
Esperado: todas as 7 asserções acima `true`, zero erros de console.

- [ ] **Step 3: Commit** — sem git, pular.

---

### Task 4: Overlay de login + modal de gerenciar veterinários (HTML + CSS)

**Files:**
- Modify: `C:\Users\tpanz\vet-dashboard\index.html` — markup novo perto dos outros modais (antes de `<!-- ==================== TOAST ==================== -->`, linha 557 do arquivo original) e CSS novo dentro do `<style id="duovet-styles">` inserido na Task 1.

**Interfaces:**
- Consumes: `DuoVet.auth.getVets/login/addVet/removeVet` (Task 3).
- Produces: elementos DOM `#auth-overlay`, `#auth-vet-select`, `#auth-senha`, `#auth-login-btn`, `#auth-error`, `#auth-manage-link`, `#modal-gerenciar-vets`, `#gerenciar-vets-list`, `#form-gerenciar-vet` — consumidos pela Task 5 (lógica de abrir/fechar e o gate de navegação).

- [ ] **Step 1: Adicionar o markup do overlay e do modal de gerenciar veterinários**

Inserir imediatamente antes de `<!-- ==================== TOAST ==================== -->`:

```html
  <!-- ==================== OVERLAY: LOGIN DO VETERINÁRIO ==================== -->
  <div id="auth-overlay" class="auth-overlay hidden">
    <div class="auth-box">
      <div class="auth-icon"><i class="ti ti-lock"></i></div>
      <h3>Identificação do Veterinário</h3>
      <p class="auth-sub">Selecione seu nome e informe a senha para acessar os prontuários.</p>
      <form id="form-auth-login">
        <div class="fl">
          <label>Veterinário</label>
          <select id="auth-vet-select" required></select>
        </div>
        <div class="fl">
          <label>Senha</label>
          <input id="auth-senha" type="password" required autocomplete="off" />
        </div>
        <div id="auth-error" class="auth-error hidden">Senha incorreta. Tente novamente.</div>
        <button type="submit" class="btn-p full"><i class="ti ti-login"></i> Entrar</button>
      </form>
      <button type="button" id="auth-manage-link" class="link-btn">Gerenciar veterinários</button>
    </div>
  </div>

  <!-- ==================== MODAL: GERENCIAR VETERINÁRIOS ==================== -->
  <div id="modal-gerenciar-vets" class="modal-overlay hidden">
    <div class="modal-box">
      <div class="modal-hd">
        <h3>Gerenciar Veterinários</h3>
        <button id="modal-gerenciar-vets-close" type="button" class="modal-close" aria-label="Fechar"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <ul id="gerenciar-vets-list" class="tag-list"></ul>
        <h4 style="font-size:13px;font-weight:600;margin:1rem 0 .75rem">Adicionar veterinário</h4>
        <form id="form-gerenciar-vet" class="form-grid">
          <div class="fl"><label>Nome</label><input id="vet-nome" type="text" required placeholder="Ex: Dr. Fulano" /></div>
          <div class="fl"><label>Senha</label><input id="vet-senha" type="text" required placeholder="Ex: 1234" /></div>
          <div class="span-2">
            <button type="submit" class="btn-p full"><i class="ti ti-plus"></i> Adicionar</button>
          </div>
        </form>
      </div>
    </div>
  </div>
```

- [ ] **Step 2: Adicionar o CSS do overlay**

Adicionar ao final do `<style id="duovet-styles">` (dentro do bloco inserido na Task 1):

```css

/* AUTENTICAÇÃO (aba Pacientes) */
.auth-overlay{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);opacity:1;transition:opacity .18s ease;}
.auth-overlay.hidden{opacity:0;pointer-events:none;}
.auth-box{width:min(360px,92vw);background:var(--card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow-lg);padding:1.75rem;text-align:center;transform:scale(1);transition:transform .18s ease;}
.auth-overlay.hidden .auth-box{transform:scale(.96);}
.auth-icon{width:48px;height:48px;border-radius:50%;background:var(--blue-l);color:var(--blue);display:flex;align-items:center;justify-content:center;font-size:22px;margin:0 auto .875rem;}
.auth-box h3{font-size:16px;margin-bottom:.375rem;}
.auth-sub{font-size:12.5px;color:var(--t3);margin-bottom:1.125rem;line-height:1.5;}
.auth-box .fl{text-align:left;margin-bottom:.75rem;}
.auth-error{font-size:12.5px;color:var(--red);background:var(--red-l);border-radius:8px;padding:.5rem .75rem;margin-bottom:.75rem;}
#auth-manage-link{margin-top:1rem;font-size:12.5px;}
```

- [ ] **Step 3: Verificar via CDP que o markup existe e começa oculto**

Criar `<scratchpad>/verify-task-4.mjs`. Confirmar via `Runtime.evaluate`: `document.getElementById("auth-overlay").classList.contains("hidden") === true`, `document.getElementById("modal-gerenciar-vets").classList.contains("hidden") === true`, e que `document.getElementById("auth-vet-select")` existe. Tirar screenshot da tela padrão (Painel) confirmando que o overlay não aparece por cima de nada (está `hidden`).

Rodar: `node <scratchpad>/verify-task-4.mjs`
Esperado: as 3 asserções `true`, screenshot sem overlay visível.

- [ ] **Step 4: Commit** — sem git, pular.

---

### Task 5: Lógica do overlay de login + gate de navegação + gerenciar veterinários

**Files:**
- Modify: `C:\Users\tpanz\vet-dashboard\index.html` — dentro do bloco `<script>` do módulo `auth` (Task 3), adicionar as funções de UI; dentro do bloco `<script>` do `main` (inserido na Task 2), modificar `initNav()`/`switchTab()`.

**Interfaces:**
- Consumes: `DuoVet.auth.getVets/login/logout/isLoggedIn/getSessionVet/addVet/removeVet` (Task 3); elementos DOM da Task 4.
- Produces: `DuoVet.auth.init()` e `DuoVet.auth.openLoginOverlay(onSuccess)`, consumidos por `main.js`.

- [ ] **Step 1: Adicionar as funções de UI dentro do módulo `auth`**

No bloco `<script>` do `auth` (Task 3), **antes** do `return { ... }`, adicionar:

```js
  // ---- UI do overlay de login -------------------------------------------------
  let pendingOnSuccess = null;

  function populateVetSelect() {
    const select = document.getElementById("auth-vet-select");
    select.innerHTML = getVets().map((v) => `<option value="${v.id}">${v.nome}</option>`).join("");
  }

  function openLoginOverlay(onSuccess) {
    pendingOnSuccess = onSuccess;
    populateVetSelect();
    document.getElementById("auth-senha").value = "";
    document.getElementById("auth-error").classList.add("hidden");
    document.getElementById("auth-overlay").classList.remove("hidden");
    document.getElementById("auth-senha").focus();
  }

  function closeLoginOverlay() {
    document.getElementById("auth-overlay").classList.add("hidden");
    pendingOnSuccess = null;
  }

  function handleLoginSubmit(event) {
    event.preventDefault();
    const vetId = document.getElementById("auth-vet-select").value;
    const senha = document.getElementById("auth-senha").value;
    if (login(vetId, senha)) {
      const callback = pendingOnSuccess;
      closeLoginOverlay();
      if (callback) callback();
    } else {
      document.getElementById("auth-error").classList.remove("hidden");
    }
  }

  // ---- UI de gerenciar veterinários --------------------------------------------
  function renderVetsList() {
    const list = document.getElementById("gerenciar-vets-list");
    list.innerHTML = getVets()
      .map((v) => `<li class="tag-item">${v.nome} <button type="button" class="link-btn link-danger btn-remover-vet" data-id="${v.id}">Remover</button></li>`)
      .join("");
  }

  function handleAddVetSubmit(event) {
    event.preventDefault();
    const nome = document.getElementById("vet-nome").value.trim();
    const senha = document.getElementById("vet-senha").value.trim();
    if (!nome || !senha) return;
    addVet({ nome, senha });
    document.getElementById("form-gerenciar-vet").reset();
    renderVetsList();
    populateVetSelect();
  }

  function handleVetsListClick(event) {
    const btn = event.target.closest(".btn-remover-vet");
    if (!btn) return;
    if (confirm("Remover este veterinário da lista?")) {
      removeVet(btn.dataset.id);
      renderVetsList();
      populateVetSelect();
    }
  }

  function init() {
    document.getElementById("form-auth-login").addEventListener("submit", handleLoginSubmit);
    document.getElementById("auth-manage-link").addEventListener("click", () => {
      renderVetsList();
      document.getElementById("modal-gerenciar-vets").classList.remove("hidden");
    });
    document.getElementById("modal-gerenciar-vets-close").addEventListener("click", () => {
      document.getElementById("modal-gerenciar-vets").classList.add("hidden");
    });
    document.getElementById("form-gerenciar-vet").addEventListener("submit", handleAddVetSubmit);
    document.getElementById("gerenciar-vets-list").addEventListener("click", handleVetsListClick);
  }
```

E adicionar `init, openLoginOverlay` ao objeto retornado:
```js
  return { getVets, addVet, removeVet, login, logout, isLoggedIn, getSessionVet, init, openLoginOverlay };
```

- [ ] **Step 2: Ligar o gate de navegação em `main.js`**

No bloco `<script>` do `main` (Task 2), dentro da IIFE, modificar `initNav()`:

Trocar:
```js
  function initNav() {
    document.querySelectorAll(".nav-btn[data-tab]").forEach((button) => {
      button.addEventListener("click", () => switchTab(button.dataset.tab));
    });
```
por:
```js
  function initNav() {
    document.querySelectorAll(".nav-btn[data-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.tab;
        if (target === "pacientes" && !DuoVet.auth.isLoggedIn()) {
          DuoVet.auth.openLoginOverlay(() => switchTab("pacientes"));
          return;
        }
        switchTab(target);
      });
    });
```

E no `DOMContentLoaded`, adicionar `DuoVet.auth.init();` logo após `DuoVet.pacientes.init();` (antes de `DuoVet.relatorio.init();` ou depois, ordem entre os dois não importa — só precisa estar dentro do mesmo bloco de inicialização):

```js
    DuoVet.pacientes.init();
    DuoVet.auth.init();
    DuoVet.relatorio.init();
```

- [ ] **Step 3: Verificar via CDP o fluxo completo de login**

Criar `<scratchpad>/verify-task-5.mjs`. Com `localStorage` limpo:
1. Clicar no botão de nav `[data-tab="pacientes"]`. Confirmar `document.getElementById("auth-overlay").classList.contains("hidden") === false` e que `document.getElementById("tab-pacientes").classList.contains("active") === false` (não trocou de aba ainda).
2. Tentar logar com senha errada: selecionar o primeiro `<option>` de `#auth-vet-select`, preencher `#auth-senha` com `"errada"`, submeter o form. Confirmar `#auth-error` fica visível (sem `hidden`) e overlay continua visível.
3. Preencher `#auth-senha` com `"1234"`, submeter. Confirmar: overlay fica `hidden`, `#tab-pacientes` fica `.active`, `DuoVet.auth.isLoggedIn() === true`.
4. Abrir "Gerenciar veterinários", adicionar um veterinário novo (nome "Dr. Verify", senha "5555"), confirmar que aparece na lista e no select; remover esse mesmo veterinário e confirmar que some da lista.
5. Confirmar `errors.length === 0`.

Rodar: `node <scratchpad>/verify-task-5.mjs`
Esperado: todas as asserções acima passam.

- [ ] **Step 4: Commit** — sem git, pular.

---

### Task 6: Cabeçalho "Logado como" + Trocar veterinário na aba Pacientes

**Files:**
- Modify: `C:\Users\tpanz\vet-dashboard\index.html` — markup dentro de `#tab-pacientes` (antes de `#pacientes-busca`); bloco `<script>` do `pacientes` (Task 2).

**Interfaces:**
- Consumes: `DuoVet.auth.getSessionVet()`, `DuoVet.auth.logout()`, `DuoVet.auth.openLoginOverlay(onSuccess)` (Task 3/5).
- Produces: nada consumido por tasks futuras (é um nó-folha de UI).

- [ ] **Step 1: Adicionar o markup do cabeçalho**

Dentro de `<section id="tab-pacientes" class="panel">`, logo depois da tag de abertura e antes de `<!-- Sub-view: Busca -->`:

```html
        <div class="pac-logged-bar">
          <span><i class="ti ti-user-check"></i> Logado: <strong id="pac-logged-nome"></strong></span>
          <button type="button" id="btn-trocar-vet" class="link-btn"><i class="ti ti-logout"></i> Trocar veterinário</button>
        </div>
```

- [ ] **Step 2: Adicionar o CSS da barra**

Adicionar ao final do `<style id="duovet-styles">`:

```css
.pac-logged-bar{display:flex;align-items:center;justify-content:space-between;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:.5rem .875rem;margin-bottom:.875rem;font-size:13px;color:var(--t2);}
.pac-logged-bar strong{color:var(--t1);}
```

- [ ] **Step 3: Ligar a lógica em `pacientes.js`**

No bloco `<script>` do `pacientes`, dentro de `init()`, adicionar:

```js
    document.getElementById("btn-trocar-vet").addEventListener("click", () => {
      DuoVet.auth.logout();
      DuoVet.auth.openLoginOverlay(() => renderLoggedBar());
    });
    renderLoggedBar();
```

E adicionar a função (antes de `init`, no mesmo escopo do módulo):

```js
  function renderLoggedBar() {
    const vet = DuoVet.auth.getSessionVet();
    const el = document.getElementById("pac-logged-nome");
    if (el) el.textContent = vet ? vet.nome : "—";
  }
```

Também chamar `renderLoggedBar()` dentro de `render()` (a função exportada, que já roda a cada `notify()`), para o nome ficar sempre correto mesmo depois de um logout/login no meio da sessão:

```js
  function render() {
    renderLoggedBar();
    if (currentView === "busca") renderSearchResults();
    else renderFicha();
  }
```

- [ ] **Step 4: Verificar via CDP**

Criar `<scratchpad>/verify-task-6.mjs`. Repetir o login (Task 5, passos 1–3) e então confirmar: `document.getElementById("pac-logged-nome").textContent` é igual ao nome do veterinário logado (ex: `"Dr. Antonio"`). Clicar em `#btn-trocar-vet`: confirmar `DuoVet.auth.isLoggedIn() === false` e que o overlay de login reaparece (`#auth-overlay` sem `hidden`).

Rodar: `node <scratchpad>/verify-task-6.mjs`
Esperado: as asserções acima passam.

- [ ] **Step 5: Commit** — sem git, pular.

---

### Task 7: Campos `internado`/`obito` no paciente + `toggleInternado`/`toggleObito` em `state.js`

**Files:**
- Modify: `C:\Users\tpanz\vet-dashboard\index.html` — bloco `<script>` do `state` (Task 2), seção "API: pacientes".

**Interfaces:**
- Consumes: nada novo.
- Produces (consumido pelas Tasks 8, 9, 10, 11): `patient.internado: boolean`, `patient.obito: boolean` (defaults `false` em `addPatient`), `DuoVet.state.toggleInternado(id)`, `DuoVet.state.toggleObito(id)`.

- [ ] **Step 1: Dar default `false` em `addPatient`**

Trocar:
```js
  function addPatient(entry) {
    patients.push({ id: generateId(), consultas: [], vacinas: [], ...entry });
    notify();
  }
```
por:
```js
  function addPatient(entry) {
    patients.push({ id: generateId(), consultas: [], vacinas: [], internado: false, obito: false, ...entry });
    notify();
  }
```

- [ ] **Step 2: Adicionar `toggleInternado`/`toggleObito`**

Logo depois de `removePatient`, antes de `addConsulta`:

```js
  function toggleInternado(id) {
    patients = patients.map((p) => (p.id === id ? { ...p, internado: !p.internado } : p));
    notify();
  }

  function toggleObito(id) {
    patients = patients.map((p) => (p.id === id ? { ...p, obito: !p.obito } : p));
    notify();
  }
```

- [ ] **Step 3: Exportar as duas novas funções**

No `return { ... }` do módulo `state`, adicionar `toggleInternado, toggleObito` (logo após `removePatient,`):
```js
    getPatients,
    addPatient,
    updatePatient,
    removePatient,
    toggleInternado,
    toggleObito,
    addConsulta,
```

- [ ] **Step 4: Verificar via CDP**

Criar `<scratchpad>/verify-task-7.mjs`. Via `Runtime.evaluate`:
1. `DuoVet.state.addPatient({nomePet:"Rex", especie:"Cão", tutorNome:"Fulano"})`. Pegar o último item de `DuoVet.state.getPatients()`: `internado === false && obito === false`.
2. `DuoVet.state.toggleInternado(id)` → `internado === true`. Chamar de novo → volta a `false`.
3. `DuoVet.state.toggleObito(id)` → `obito === true`.
4. `DuoVet.state.addPatient({nomePet:"Miau", especie:"Gato", tutorNome:"Ciclana", internado:true})` → confirma que passar o campo explicitamente sobrescreve o default (`internado === true`).

Rodar: `node <scratchpad>/verify-task-7.mjs`
Esperado: as 4 asserções passam.

- [ ] **Step 5: Commit** — sem git, pular.

---

### Task 8: Checkboxes Internado/Óbito no modal de paciente; campo Peso no modal de consulta

**Files:**
- Modify: `C:\Users\tpanz\vet-dashboard\index.html` — markup de `#form-paciente` e `#form-consulta`; bloco `<script>` do `pacientes`.

**Interfaces:**
- Consumes: `DuoVet.state.addPatient/updatePatient/addConsulta` (já existentes; `addConsulta` já repassa qualquer campo extra do `entry`, incluindo `peso`, sem precisar de mudança em `state.js`).
- Produces: `entry.internado`, `entry.obito` no submit do form de paciente; `entry.peso: number | null` no submit do form de consulta — consumidos pela Task 9 (sparkline) e pela renderização da timeline.

- [ ] **Step 1: Adicionar os checkboxes ao `#form-paciente`**

Em `index.html`, dentro de `<form id="form-paciente" class="form-grid">`, logo antes do `<div class="span-2"><button id="paciente-submit"...`, adicionar:

```html
          <div class="fl">
            <label><input id="paciente-internado" type="checkbox" /> Internado</label>
          </div>
          <div class="fl">
            <label><input id="paciente-obito" type="checkbox" /> Óbito</label>
          </div>
```

- [ ] **Step 2: Adicionar o campo Peso ao `#form-consulta`**

Dentro de `<form id="form-consulta" class="form-grid">`, logo depois do campo Data:

```html
          <div class="fl"><label>Peso (kg) <span class="hint">(opcional)</span></label><input id="consulta-peso" type="number" min="0" step="0.1" /></div>
```

- [ ] **Step 3: Ler/gravar os checkboxes em `pacientes.js` (submit e edição)**

Em `handleSubmitPaciente`, adicionar ao objeto `entry`:
```js
      internado: document.getElementById("paciente-internado").checked,
      obito: document.getElementById("paciente-obito").checked,
```

Em `openEditarPacienteModal`, adicionar:
```js
    document.getElementById("paciente-internado").checked = !!patient.internado;
    document.getElementById("paciente-obito").checked = !!patient.obito;
```

Em `openNovoPacienteModal`, o `.reset()` do form já desmarca os checkboxes — nenhuma mudança extra necessária ali.

- [ ] **Step 4: Ler o peso em `handleSubmitConsulta`**

Trocar:
```js
    const entry = {
      data: new Date(document.getElementById("consulta-data").value + "T00:00:00"),
      motivo: document.getElementById("consulta-motivo").value.trim(),
      diagnostico: document.getElementById("consulta-diagnostico").value.trim(),
      prescricao: document.getElementById("consulta-prescricao").value.trim(),
    };
```
por:
```js
    const pesoRaw = document.getElementById("consulta-peso").value;
    const entry = {
      data: new Date(document.getElementById("consulta-data").value + "T00:00:00"),
      motivo: document.getElementById("consulta-motivo").value.trim(),
      diagnostico: document.getElementById("consulta-diagnostico").value.trim(),
      prescricao: document.getElementById("consulta-prescricao").value.trim(),
      peso: pesoRaw ? parseFloat(pesoRaw) : null,
    };
```

E em `openNovaConsultaModal`, o `.reset()` do form já limpa o campo — nenhuma mudança extra.

- [ ] **Step 5: Mostrar o peso na timeline (quando presente)**

Em `renderConsultasTimeline`, dentro do `.map((c) => ...)`, adicionar logo depois da linha `${c.motivo}</div>`:
```js
          ${c.peso ? `<div class="ti-detail"><strong>Peso:</strong> ${c.peso} kg</div>` : ""}
```

- [ ] **Step 6: Verificar via CDP**

Criar `<scratchpad>/verify-task-8.mjs`. Login já feito (reusar passos da Task 5). Via UI real (cliques/preenchimento, não só `DuoVet.state.*` direto):
1. Abrir "Novo Paciente", preencher Nome do Pet/Espécie/Tutor, marcar o checkbox "Internado", **não** marcar "Óbito", submeter. Confirmar no `DuoVet.state.getPatients()` que o último paciente tem `internado === true, obito === false`.
2. Abrir a ficha desse paciente, clicar "Registrar Nova Consulta", preencher Motivo e Peso = `4.5`, submeter. Confirmar que `patient.consultas[0].peso === 4.5`.
3. Confirmar que a timeline renderizada (`#pac-consultas-timeline`) contém o texto `"Peso:"` e `"4.5 kg"`.
4. Repetir o registro de consulta deixando Peso em branco; confirmar `consultas[1].peso === null` e que esse item da timeline **não** contém `"Peso:"`.

Rodar: `node <scratchpad>/verify-task-8.mjs`
Esperado: as 4 verificações passam.

- [ ] **Step 7: Commit** — sem git, pular.

---

### Task 9: Busca agrupada por tutor (alternador Tutor/Pet)

**Files:**
- Modify: `C:\Users\tpanz\vet-dashboard\index.html` — markup de `#pacientes-busca`; bloco `<script>` do `pacientes`; CSS.

**Interfaces:**
- Consumes: `DuoVet.state.getPatients()` (já existe).
- Produces: `filteredGroups()` substitui `filteredPatients()`; `renderSearchResults()` passa a renderizar cards de tutor. `openFicha(patientId)` continua com a mesma assinatura (consumido pela Task 10).

- [ ] **Step 1: Adicionar o alternador Tutor/Pet ao markup de busca**

Trocar (dentro de `#pacientes-busca`):
```html
          <div class="card" style="max-width:640px;margin:0 auto 1rem">
            <div class="card-body" style="display:flex;gap:.75rem;align-items:center">
              <input id="pacientes-search-input" type="text" placeholder="Buscar por nome do pet ou do tutor..." style="flex:1;border:1.5px solid var(--border);border-radius:8px;padding:.6rem .9rem;font-size:14px;background:var(--card2);color:var(--t1)" />
              <button id="btn-novo-paciente" type="button" class="btn-p"><i class="ti ti-plus"></i> Novo Paciente</button>
            </div>
          </div>
```
por:
```html
          <div class="card" style="max-width:640px;margin:0 auto 1rem">
            <div class="card-body" style="display:flex;flex-direction:column;gap:.75rem">
              <div class="search-mode-pill">
                <button type="button" class="smp-btn active" data-mode="tutor">Buscar por Tutor</button>
                <button type="button" class="smp-btn" data-mode="pet">Buscar por Pet</button>
              </div>
              <div style="display:flex;gap:.75rem;align-items:center">
                <input id="pacientes-search-input" type="text" placeholder="Buscar por nome do tutor ou código (CPF)..." style="flex:1;border:1.5px solid var(--border);border-radius:8px;padding:.6rem .9rem;font-size:14px;background:var(--card2);color:var(--t1)" />
                <button id="btn-novo-paciente" type="button" class="btn-p"><i class="ti ti-plus"></i> Novo Paciente</button>
              </div>
            </div>
          </div>
```

- [ ] **Step 2: CSS do alternador e dos cards de tutor**

Adicionar ao final do `<style id="duovet-styles">`:

```css
.search-mode-pill{display:inline-flex;background:var(--card2);border-radius:8px;padding:3px;gap:2px;align-self:flex-start;}
.smp-btn{border:none;background:transparent;color:var(--t3);font-size:12.5px;font-weight:600;padding:.4rem .75rem;border-radius:6px;cursor:pointer;transition:background .15s,color .15s;}
.smp-btn.active{background:var(--card);color:var(--t1);box-shadow:var(--shadow);}
.tutor-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;}
.tutor-card-hd{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:.6rem;}
.tutor-card-nome{font-weight:700;font-size:14.5px;}
.tutor-card-codigo{font-size:11.5px;color:var(--t3);}
.tutor-pets-chips{display:flex;flex-wrap:wrap;gap:.5rem;}
.pet-chip{display:flex;align-items:center;gap:.4rem;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:.4rem .7rem;font-size:13px;cursor:pointer;transition:border-color .15s;}
.pet-chip:hover{border-color:var(--blue);}
.status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.status-dot--obito{background:var(--red);}
.status-dot--internado{background:var(--amber);}
```

- [ ] **Step 3: Reescrever a busca e a renderização em `pacientes.js`**

Trocar `searchTerm` por `searchTerm` + `searchMode`, e `filteredPatients` por `filteredGroups`:

```js
  let searchTerm = "";
  let searchMode = "tutor"; // "tutor" | "pet"
```

Trocar:
```js
  function filteredPatients() {
    const term = searchTerm.trim().toLowerCase();
    const all = DuoVet.state.getPatients();
    if (!term) return all;
    return all.filter(
      (p) => p.nomePet.toLowerCase().includes(term) || p.tutorNome.toLowerCase().includes(term)
    );
  }
```
por:
```js
  function groupKey(patient) {
    return (patient.tutorCpf || "").trim() || patient.tutorNome.trim().toLowerCase();
  }

  function filteredGroups() {
    const term = searchTerm.trim().toLowerCase();
    const all = DuoVet.state.getPatients();

    const matchingIds = new Set(
      all
        .filter((p) => {
          if (!term) return true;
          if (searchMode === "pet") return p.nomePet.toLowerCase().includes(term);
          return p.tutorNome.toLowerCase().includes(term) || (p.tutorCpf || "").includes(term);
        })
        .map((p) => p.id)
    );
    if (matchingIds.size === 0) return [];

    const relevantKeys = new Set(all.filter((p) => matchingIds.has(p.id)).map(groupKey));
    const groups = new Map();
    all.forEach((p) => {
      const key = groupKey(p);
      if (!relevantKeys.has(key)) return;
      if (!groups.has(key)) groups.set(key, { tutorNome: p.tutorNome, tutorCpf: p.tutorCpf, pets: [] });
      groups.get(key).pets.push(p);
    });
    return Array.from(groups.values());
  }
```

Trocar `renderSearchResults`:
```js
  function renderSearchResults() {
    const container = document.getElementById("pacientes-results");
    if (!container) return;
    const results = filteredPatients();

    if (results.length === 0) {
      container.innerHTML = `
        <div class="empty" style="grid-column:1/-1">
          <i class="ti ti-search"></i>
          <p>${DuoVet.state.getPatients().length === 0 ? "Nenhum paciente cadastrado ainda." : "Nenhum paciente encontrado."}</p>
        </div>`;
      return;
    }

    container.innerHTML = results
      .map(
        (p) => `
      <div class="patient-card" data-id="${p.id}">
        <div class="pc-name">${p.nomePet}</div>
        <div class="pc-tutor">${p.tutorNome}</div>
        <div class="pc-meta">${[p.especie, p.raca].filter(Boolean).join(" · ") || "—"}</div>
      </div>`
      )
      .join("");
  }
```
por:
```js
  function statusDotsHtml(p) {
    return `${p.obito ? '<span class="status-dot status-dot--obito" title="Óbito"></span>' : ""}${
      !p.obito && p.internado ? '<span class="status-dot status-dot--internado" title="Internado"></span>' : ""
    }`;
  }

  function renderSearchResults() {
    const container = document.getElementById("pacientes-results");
    if (!container) return;
    const groups = filteredGroups();

    if (groups.length === 0) {
      container.innerHTML = `
        <div class="empty" style="grid-column:1/-1">
          <i class="ti ti-search"></i>
          <p>${DuoVet.state.getPatients().length === 0 ? "Nenhum paciente cadastrado ainda." : "Nenhum paciente encontrado."}</p>
        </div>`;
      return;
    }

    container.innerHTML = groups
      .map(
        (g) => `
      <div class="tutor-card">
        <div class="tutor-card-hd">
          <span class="tutor-card-nome">${g.tutorNome}</span>
          <span class="tutor-card-codigo">${g.tutorCpf ? "Código: " + g.tutorCpf.slice(-4) : ""}</span>
        </div>
        <div class="tutor-pets-chips">
          ${g.pets
            .map(
              (p) => `
            <div class="pet-chip" data-id="${p.id}">
              ${statusDotsHtml(p)}<span>${p.nomePet}</span>
            </div>`
            )
            .join("")}
        </div>
      </div>`
      )
      .join("");
  }
```

Trocar `handleResultsClick` (o seletor de card muda de `.patient-card` para `.pet-chip`):
```js
  function handleResultsClick(event) {
    const card = event.target.closest(".patient-card");
    if (!card) return;
    openFicha(card.dataset.id);
  }
```
por:
```js
  function handleResultsClick(event) {
    const chip = event.target.closest(".pet-chip");
    if (!chip) return;
    openFicha(chip.dataset.id);
  }
```

Adicionar o handler do alternador (antes de `init`):
```js
  function handleSearchModeClick(event) {
    const btn = event.target.closest(".smp-btn");
    if (!btn) return;
    searchMode = btn.dataset.mode;
    document.querySelectorAll(".smp-btn").forEach((b) => b.classList.toggle("active", b === btn));
    renderSearchResults();
  }
```

E em `init()`, adicionar (perto dos outros listeners de busca):
```js
    document.querySelector(".search-mode-pill").addEventListener("click", handleSearchModeClick);
```

- [ ] **Step 4: Verificar via CDP**

Criar `<scratchpad>/verify-task-9.mjs`. Login feito. Seed via `DuoVet.state.addPatient`: dois pacientes com `tutorCpf: "111.222.333-44"` (nomes de pet diferentes, ex. "Fluck" e "Mimi", mesmo `tutorNome: "Maria Silva"`), e um terceiro paciente com `tutorCpf: "999.888.777-66"`, `tutorNome: "João"`, pet "Rex".
1. Modo padrão é "Tutor" (`.smp-btn[data-mode="tutor"]` tem `.active`). Digitar `"Maria"` no campo de busca. Confirmar que aparece exatamente 1 `.tutor-card` e que ele contém 2 `.pet-chip` (Fluck e Mimi) — o agrupamento automático funcionando.
2. Clicar no modo "Pet". Digitar `"Rex"`. Confirmar que aparece 1 `.tutor-card` (o do João) com 1 `.pet-chip` (Rex) — busca por pet ainda funciona, e ainda mostra agrupado.
3. Clicar no `.pet-chip` do "Fluck": confirmar que abre a ficha (`#pacientes-ficha.active`) do paciente correto (`activePatientId` bate com o id do Fluck — checar via o nome exibido na ficha).

Rodar: `node <scratchpad>/verify-task-9.mjs`
Esperado: as 3 verificações passam.

- [ ] **Step 5: Commit** — sem git, pular.

---

### Task 10: Layout de 2 colunas na ficha (sidebar de pets do tutor + prontuário em destaque)

**Files:**
- Modify: `C:\Users\tpanz\vet-dashboard\index.html` — markup de `#pacientes-ficha`; bloco `<script>` do `pacientes`; CSS.

**Interfaces:**
- Consumes: `filteredGroups`/`groupKey` (Task 9), `DuoVet.state.getPatients/toggleInternado/toggleObito` (Task 7).
- Produces: `renderFicha` passa a chamar `renderSidebar` além das funções já existentes; nenhuma API nova é consumida por outra task (é a "folha" do fluxo de UI).

- [ ] **Step 1: Restructurar o markup de `#pacientes-ficha`**

Trocar:
```html
        <!-- Sub-view: Ficha -->
        <div id="pacientes-ficha" class="pac-view">
          <button id="btn-voltar-busca" type="button" class="btn-g" style="margin-bottom:.875rem"><i class="ti ti-arrow-left"></i> Voltar à busca</button>
          <div class="g2 pac-ficha-grid">
            <div class="card" id="pac-cadastro-panel"></div>
            <div>
              <div class="card" id="pac-ultima-visita"></div>
              <div class="card">
                <div class="card-hd">
                  <div class="card-title"><i class="ti ti-timeline"></i> Consultas</div>
                  <button id="btn-nova-consulta" type="button" class="btn-g"><i class="ti ti-plus"></i> Registrar Nova Consulta</button>
                </div>
                <div class="card-body"><ul id="pac-consultas-timeline" class="timeline-list"></ul></div>
              </div>
              <div class="card">
                <div class="card-hd">
                  <div class="card-title"><i class="ti ti-vaccine"></i> Vacinação</div>
                  <button id="btn-nova-vacina" type="button" class="btn-g"><i class="ti ti-plus"></i> Aplicar Nova Vacina</button>
                </div>
                <div class="card-body">
                  <div id="pac-vacina-alerts"></div>
                  <div style="overflow-x:auto">
                    <table><thead><tr>
                      <th>Vacina</th><th>Data</th><th>Lote</th><th class="text-right">Ações</th>
                    </tr></thead><tbody id="pac-vacinas-tbody"></tbody></table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
```
por:
```html
        <!-- Sub-view: Ficha -->
        <div id="pacientes-ficha" class="pac-view">
          <button id="btn-voltar-busca" type="button" class="btn-g" style="margin-bottom:.875rem"><i class="ti ti-arrow-left"></i> Voltar à busca</button>
          <div class="pac-ficha-layout">
            <div class="card" id="pac-sidebar"></div>
            <div class="pac-ficha-main">
              <div class="card" id="pac-cadastro-panel"></div>
              <div class="card" id="pac-ultima-visita"></div>
              <div class="card" id="pac-peso-sparkline-card" style="display:none">
                <div class="card-hd"><div class="card-title"><i class="ti ti-chart-line"></i> Histórico de Peso</div></div>
                <div class="card-body"><div id="pac-peso-sparkline" class="weight-sparkline"></div></div>
              </div>
              <div class="card">
                <div class="card-hd">
                  <div class="card-title"><i class="ti ti-timeline"></i> Evolução Clínica</div>
                  <button id="btn-nova-consulta" type="button" class="btn-g"><i class="ti ti-plus"></i> Registrar Nova Consulta</button>
                </div>
                <div class="card-body"><ul id="pac-consultas-timeline" class="timeline-list"></ul></div>
              </div>
              <div class="card">
                <div class="card-hd">
                  <div class="card-title"><i class="ti ti-vaccine"></i> Vacinação</div>
                  <button id="btn-nova-vacina" type="button" class="btn-g"><i class="ti ti-plus"></i> Aplicar Nova Vacina</button>
                </div>
                <div class="card-body">
                  <div id="pac-vacina-alerts"></div>
                  <div style="overflow-x:auto">
                    <table><thead><tr>
                      <th>Vacina</th><th>Data</th><th>Lote</th><th class="text-right">Ações</th>
                    </tr></thead><tbody id="pac-vacinas-tbody"></tbody></table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
```

- [ ] **Step 2: CSS do novo layout**

Adicionar ao final do `<style id="duovet-styles">`:

```css
.pac-ficha-layout{display:grid;grid-template-columns:280px 1fr;gap:1rem;align-items:start;}
@media (max-width:860px){.pac-ficha-layout{grid-template-columns:1fr;}}
.pac-ficha-main{display:flex;flex-direction:column;gap:1rem;}
.pac-sidebar-tutor{padding:1rem;border-bottom:1px solid var(--border);}
.pac-sidebar-tutor-nome{font-weight:700;font-size:14.5px;margin-bottom:.3rem;}
.pac-sidebar-tutor-meta{font-size:12px;color:var(--t3);line-height:1.6;}
.pac-sidebar-pets{padding:.6rem;display:flex;flex-direction:column;gap:.4rem;}
.pac-sidebar-pet{display:flex;align-items:center;gap:.5rem;padding:.55rem .7rem;border-radius:8px;cursor:pointer;font-size:13px;border:1px solid transparent;transition:background .15s,border-color .15s;}
.pac-sidebar-pet:hover{background:var(--card2);}
.pac-sidebar-pet.active{background:var(--blue-l);border-color:var(--blue);font-weight:600;}
.status-badge{display:inline-flex;align-items:center;gap:.35rem;font-size:11.5px;font-weight:700;padding:.3rem .6rem;border-radius:20px;cursor:pointer;border:1.5px solid transparent;user-select:none;}
.status-badge--obito{background:var(--card2);color:var(--t3);}
.status-badge--obito.on{background:var(--red-l);color:var(--red);border-color:var(--red);}
.status-badge--internado{background:var(--card2);color:var(--t3);}
.status-badge--internado.on{background:var(--amber-l);color:var(--amber);border-color:var(--amber);}
.weight-sparkline{display:flex;align-items:flex-end;gap:5px;height:60px;padding-top:.5rem;}
.weight-bar{flex:1;background:var(--blue-l);border-radius:4px 4px 0 0;position:relative;min-height:4px;}
.weight-bar span{position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:10px;color:var(--t3);white-space:nowrap;}
```

- [ ] **Step 3: `renderSidebar` + badges de status + sparkline em `pacientes.js`**

Adicionar (antes de `renderFicha`, no mesmo escopo do módulo):

```js
  function petsDoTutor(patient) {
    const key = groupKey(patient);
    return DuoVet.state.getPatients().filter((p) => groupKey(p) === key);
  }

  function renderSidebar(patient) {
    const panel = document.getElementById("pac-sidebar");
    if (!panel) return;
    const pets = petsDoTutor(patient);
    panel.innerHTML = `
      <div class="pac-sidebar-tutor">
        <div class="pac-sidebar-tutor-nome"><i class="ti ti-user"></i> ${patient.tutorNome}</div>
        <div class="pac-sidebar-tutor-meta">
          ${patient.tutorTelefone ? `<div>${patient.tutorTelefone}</div>` : ""}
          ${patient.tutorCpf ? `<div>CPF: ${patient.tutorCpf}</div>` : ""}
        </div>
      </div>
      <div class="pac-sidebar-pets">
        ${pets
          .map(
            (p) => `
          <div class="pac-sidebar-pet${p.id === patient.id ? " active" : ""}" data-id="${p.id}">
            ${statusDotsHtml(p)}<span>${p.nomePet}</span>
          </div>`
          )
          .join("")}
      </div>`;
    panel.querySelectorAll(".pac-sidebar-pet").forEach((el) => {
      el.addEventListener("click", () => openFicha(el.dataset.id));
    });
  }

  function renderStatusBadges(patient) {
    const panel = document.getElementById("pac-cadastro-panel");
    const badges = panel.querySelector(".pac-status-badges");
    if (!badges) return;
    badges.querySelector(".status-badge--internado").classList.toggle("on", !!patient.internado);
    badges.querySelector(".status-badge--obito").classList.toggle("on", !!patient.obito);
  }

  function renderWeightSparkline(patient) {
    const card = document.getElementById("pac-peso-sparkline-card");
    const container = document.getElementById("pac-peso-sparkline");
    if (!card || !container) return;
    const points = patient.consultas
      .filter((c) => typeof c.peso === "number")
      .slice()
      .sort((a, b) => a.data - b.data);
    if (points.length < 2) {
      card.style.display = "none";
      return;
    }
    card.style.display = "";
    const max = Math.max(...points.map((p) => p.peso));
    container.innerHTML = points
      .map((p) => `<div class="weight-bar" style="height:${Math.max(8, (p.peso / max) * 100)}%"><span>${p.peso}kg</span></div>`)
      .join("");
  }
```

- [ ] **Step 4: Adicionar os badges clicáveis ao cabeçalho do cadastro**

Em `renderCadastroPanel`, trocar o `card-hd`:
```js
      <div class="card-hd">
        <div class="card-title"><i class="ti ti-paw"></i> ${patient.nomePet}</div>
        <button type="button" class="btn-g" id="btn-editar-cadastro"><i class="ti ti-edit"></i> Editar</button>
      </div>
```
por:
```js
      <div class="card-hd" style="flex-wrap:wrap;gap:.6rem">
        <div class="card-title"><i class="ti ti-paw"></i> ${patient.nomePet}</div>
        <div class="pac-status-badges" style="display:flex;gap:.5rem">
          <span class="status-badge status-badge--internado${patient.internado ? " on" : ""}" data-action="internado"><i class="ti ti-building-hospital"></i> Internado</span>
          <span class="status-badge status-badge--obito${patient.obito ? " on" : ""}" data-action="obito"><i class="ti ti-cross"></i> Óbito</span>
        </div>
        <button type="button" class="btn-g" id="btn-editar-cadastro"><i class="ti ti-edit"></i> Editar</button>
      </div>
```

E, no final de `renderCadastroPanel` (depois do `addEventListener("click", () => openEditarPacienteModal(patient))` já existente), adicionar os handlers dos badges:
```js
    panel.querySelector('[data-action="internado"]').addEventListener("click", () => {
      DuoVet.state.toggleInternado(patient.id);
    });
    panel.querySelector('[data-action="obito"]').addEventListener("click", () => {
      if (confirm("Confirmar óbito deste paciente? Essa é uma marcação clínica importante.")) {
        DuoVet.state.toggleObito(patient.id);
      }
    });
```

- [ ] **Step 5: Chamar as novas funções em `renderFicha`**

Trocar:
```js
  function renderFicha() {
    const patient = currentPatient();
    if (!patient) {
      backToSearch();
      return;
    }
    renderCadastroPanel(patient);
    renderUltimaVisita(patient);
    renderConsultasTimeline(patient);
    renderVacinasTable(patient);
    renderVacinaAlerts(patient);
  }
```
por:
```js
  function renderFicha() {
    const patient = currentPatient();
    if (!patient) {
      backToSearch();
      return;
    }
    renderSidebar(patient);
    renderCadastroPanel(patient);
    renderStatusBadges(patient);
    renderUltimaVisita(patient);
    renderWeightSparkline(patient);
    renderConsultasTimeline(patient);
    renderVacinasTable(patient);
    renderVacinaAlerts(patient);
  }
```

(Nota: `renderStatusBadges` é redundante logo após `renderCadastroPanel` já ter desenhado os badges corretos do zero via template — é mantida só por clareza/segurança caso outro fluxo re-renderize sem recriar o HTML. Não causa bug, é idempotente.)

- [ ] **Step 6: Verificar via CDP**

Criar `<scratchpad>/verify-task-10.mjs`. Login feito. Seed: tutor "Maria Silva" com 2 pets ("Fluck", "Mimi"), CPF igual nos dois.
1. Abrir a ficha do "Fluck". Confirmar `#pac-sidebar` contém 2 itens `.pac-sidebar-pet`, e o do "Fluck" tem classe `.active`.
2. Clicar no item da sidebar referente a "Mimi". Confirmar que a ficha troca (`#pac-cadastro-panel` agora mostra "Mimi" no título) sem passar pela tela de busca.
3. Clicar no badge "Internado" no cabeçalho do cadastro: confirmar `DuoVet.state.getPatients().find(p=>p.nomePet==="Mimi").internado === true` e que o badge ganhou a classe `.on` visualmente (checar via `classList`).
4. Clicar no badge "Óbito" (o `confirm()` é auto-aceito pelo listener de diálogo do script CDP, como já é padrão nesta sessão): confirmar `obito === true` e badge com `.on`.
5. Registrar 2 consultas em "Mimi" com pesos `3.0` e `3.4`. Confirmar que `#pac-peso-sparkline-card` deixa de estar `display:none` e que `#pac-peso-sparkline` contém 2 elementos `.weight-bar`.
6. Tirar screenshot da ficha completa para conferência visual (sidebar à esquerda mais estreita, prontuário à direita ocupando a maior parte da largura).

Rodar: `node <scratchpad>/verify-task-10.mjs`
Esperado: todas as verificações acima passam; screenshot mostra o layout de 2 colunas como especificado.

- [ ] **Step 7: Commit** — sem git, pular.

---

### Task 11: Regressão completa + verificação visual final

**Files:**
- Nenhuma modificação de código — só verificação.

**Interfaces:**
- Consumes: toda a aplicação.

- [ ] **Step 1: Rodar uma verificação CDP fim-a-fim cobrindo todas as abas**

Criar `<scratchpad>/verify-task-11-regressao.mjs`. Com `localStorage` limpo:
1. Confirmar que a aba Painel abre por padrão sem exigir login.
2. Percorrer as abas `venda, servicos, gastos, historico, calendario` clicando em cada uma, confirmando `.active` e zero erros de console.
3. Clicar em "Pacientes": confirmar overlay de login aparece; logar; confirmar a aba libera.
4. Cadastrar um paciente completo (com Internado marcado), registrar 2 consultas (uma com peso, outra sem), aplicar 1 vacina com "Próxima dose" em 5 dias (deve gerar alerta `.alert-caution`) e 1 vacina com "Próxima dose" em -3 dias (deve gerar `.alert-danger`).
5. Ir à aba Painel, seguir até o card "Relatório Mensal" (agora no final da página), gerar o PDF do mês atual usando a técnica de captura de blob via `URL.createObjectURL` já estabelecida nesta sessão (patch antes do clique, leitura via `FileReader.readAsDataURL`), e confirmar que o PDF gerado tem tamanho > 0 bytes e contém a string `"DuoVet"` (inspeção `latin1` dos bytes, mesmo método já usado antes).
6. Confirmar `errors.length === 0` ao longo de todo o percurso.

Rodar: `node <scratchpad>/verify-task-11-regressao.mjs`
Esperado: todas as verificações acima passam, zero erros de console em qualquer ponto do percurso.

- [ ] **Step 2: Abrir no navegador real do usuário para conferência visual**

Rodar: `powershell -Command "Start-Process 'C:\Users\tpanz\vet-dashboard\index.html'"`

- [ ] **Step 3: Commit** — sem git, pular.

---

## Self-Review (feito ao final da escrita deste plano)

- **Cobertura da spec:** login por contexto (Tasks 3–6), busca por tutor com agrupamento automático (Task 9), status Internado/Óbito em destaque (Tasks 7, 8, 10), prontuário em área nobre com timeline + histórico de peso (Task 10), arquivo único (Tasks 1–2) — todos os itens da spec de 2026-07-13 têm task correspondente. Nenhum item ficou sem cobertura.
- **Placeholders:** nenhum "TBD"/"implementar depois" — toda task tem código completo ou instrução mecânica precisa (cópia literal de arquivo já existente, nas Tasks 1 e 2, justificada por serem migrações sem lógica nova).
- **Consistência de nomes:** `DuoVet.auth.{getVets, addVet, removeVet, login, logout, isLoggedIn, getSessionVet, init, openLoginOverlay}` usados de forma consistente entre Tasks 3, 5 e 6. `DuoVet.state.{toggleInternado, toggleObito}` (Task 7) usados com esse exato nome nas Tasks 8 e 10. `filteredGroups`/`groupKey` (Task 9) reaproveitados sem mudança de nome na Task 10 (`petsDoTutor`).
