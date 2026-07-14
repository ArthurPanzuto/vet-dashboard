# Backend Firebase Multi-Organização + GitHub Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o `localStorage` do DuoVet por um backend compartilhado no Firebase (Firestore + Authentication), multi-organização desde já, e publicar o app no GitHub Pages.

**Architecture:** O app continua um único `index.html` estático (sem build). O SDK do Firebase é carregado via `<script src>` clássico (build "compat", que expõe o global `firebase`, igual ao padrão já usado para Chart.js/jsPDF — sem `type="module"`, sem ordem de carregamento especial). O módulo `state` deixa de usar `localStorage` e passa a sincronizar em tempo real (`onSnapshot`) com subcoleções do Firestore dentro de `organizations/{orgId}/...`, mantendo a mesma API pública. O módulo `auth` passa a usar Firebase Authentication (email/senha), com cadastro (uma vez, por vet) pedindo também o código da organização/clínica; login do dia a dia é só email+senha. O login passa a proteger o app inteiro.

**Tech Stack:** HTML/CSS/JS puro, Firebase JS SDK v12 (compat build via CDN gstatic), Firestore, Firebase Authentication (Email/senha), GitHub Pages.

## Global Constraints

- Nenhuma etapa de build/npm — tudo carregado via `<script src>` de CDN, igual ao padrão já existente (Chart.js, jsPDF).
- Versão do Firebase JS SDK fixada em `12.16.0` (compat build), URLs: `https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js`, `firebase-auth-compat.js`, `firebase-firestore-compat.js`.
- Plano gratuito "Spark" do Firebase — sem Cloud Functions, sem servidor próprio.
- Modelo de dados multi-organização: toda coleção de dados vive em `organizations/{orgId}/...`; `orgId` é um código curto escolhido manualmente pelo administrador (ex: `duovet`), não um id aleatório.
- Sem migração dos dados de teste do `localStorage` atual — o Firestore começa vazio (com seed automático só das categorias/tipos de evento padrão, replicando o comportamento atual de "primeira execução").
- Sem tela de autocadastro de organização, sem recuperação de senha, sem verificação de email, sem modo offline — apenas o que está descrito nas tarefas abaixo.
- Login (cadastro + entrar) passa a ser exigido para o app inteiro, sem botão Cancelar/X nem ESC no overlay (decisão explícita: não há mais "aba livre" para onde cancelar).
- Repositório GitHub deve ser público (exigência do GitHub Pages gratuito); as chaves de configuração do Firebase não são segredas.

---

### Task 1: Git, documentação e regras do Firestore

**Files:**
- Create: `C:\Users\tpanz\vet-dashboard\.gitignore`
- Create: `C:\Users\tpanz\vet-dashboard\README.md`
- Create: `C:\Users\tpanz\vet-dashboard\firestore.rules`

**Interfaces:**
- Produces: `firestore.rules` (conteúdo publicado manualmente pelo usuário no Console do Firebase na Task 8); `README.md` (guia manual consultado nas Tasks 2 e 8).

- [ ] **Step 1: Inicializar o repositório git**

Run:
```bash
cd "C:/Users/tpanz/vet-dashboard"
git init
git branch -M main
```
Expected: `Initialized empty Git repository in C:/Users/tpanz/vet-dashboard/.git/`

- [ ] **Step 2: Criar `.gitignore`**

```
.DS_Store
Thumbs.db
```

- [ ] **Step 3: Criar `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Perfil global do veterinário: diz a qual organização ele pertence.
    // Só pode ser criado se o email autenticado estiver na allowlist da
    // organização informada — é o que impede autocadastro fora da clínica.
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow create: if request.auth != null
        && request.auth.uid == uid
        && request.resource.data.orgId is string
        && exists(/databases/$(database)/documents/organizations/$(request.resource.data.orgId)/allowlist/$(request.auth.token.email.lower()));
      allow update, delete: if false;
    }

    match /organizations/{orgId} {
      // O documento da organização em si e sua allowlist nunca são lidos
      // nem escritos pelo cliente — só editados manualmente no Console.
      allow read, write: if false;

      match /allowlist/{email} {
        allow read, write: if false;
      }

      // Qualquer subcoleção de dados (patients, transactions, despesas,
      // appointments, categories, eventTypes) exige que o usuário logado
      // pertença a esta mesma organização.
      match /{document=**} {
        allow read, write: if request.auth != null
          && exists(/databases/$(database)/documents/users/$(request.auth.uid))
          && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.orgId == orgId;
      }
    }
  }
}
```

- [ ] **Step 4: Criar `README.md`**

```markdown
# DuoVet — Painel da Clínica

App único (`index.html`) para gestão de pacientes, financeiro e agenda da clínica veterinária. Os dados são compartilhados em tempo real entre os veterinários via Firebase, com suporte a múltiplas clínicas (organizações) isoladas entre si.

## Rodando localmente

Abra `index.html` diretamente no navegador. Sem build, sem npm.

## Configuração do Firebase (obrigatória, feita uma vez por quem administra o projeto)

1. Acesse https://console.firebase.google.com/ e crie um projeto novo (plano gratuito "Spark").
2. No menu lateral, vá em **Build → Firestore Database** → "Criar banco de dados" (modo produção, escolha a região mais próxima).
3. Vá em **Build → Authentication → Sign-in method** e ative o provedor **Email/senha**.
4. Vá em **Configurações do projeto → Geral → Seus apps**, crie um "App da Web" (ícone `</>`) e copie o objeto `firebaseConfig` mostrado.
5. Abra `index.html`, procure o comentário `CONFIGURAÇÃO DO FIREBASE — COLE AQUI` (no `<head>`) e substitua os valores de exemplo pelos copiados no passo 4.
6. Em **Firestore Database → Regras**, cole o conteúdo do arquivo `firestore.rules` deste repositório e publique.
7. Em **Firestore Database → Dados**, crie manualmente o documento `organizations/duovet` com o campo `nome: "DuoVet"`.
8. Dentro dele, crie a subcoleção `allowlist` com um documento para cada veterinário autorizado — o **ID do documento** é o email dele em minúsculas (ex: `antonio@suaclinica.com`); o conteúdo pode ficar vazio.
9. Pronto — cada veterinário pode abrir o site, clicar em "Criar conta" e usar o código da clínica `duovet` + o email liberado no passo 8.

### Adicionar uma nova clínica no futuro

Repita os passos 7 e 8 com um novo código de organização (ex: `clinica-sul`) e a allowlist daquela clínica. Cada organização fica automaticamente isolada das demais — não é preciso mexer no código do app.

## Publicação (GitHub Pages)

Qualquer `git push` para a branch `main` atualiza o site publicado em `https://<usuário-github>.github.io/vet-dashboard/`.
```

- [ ] **Step 5: Commit inicial**

```bash
cd "C:/Users/tpanz/vet-dashboard"
git add .gitignore README.md firestore.rules docs/superpowers/specs/2026-07-13-firebase-backend-design.md docs/superpowers/plans/2026-07-13-firebase-backend-plan.md
git commit -m "docs: add Firebase backend design, plan, README and security rules"
```
Expected: commit created listing the 5 files above.

---

### Task 2: Carregar o SDK do Firebase e configurar o projeto

**Files:**
- Modify: `C:\Users\tpanz\vet-dashboard\index.html:12-14` (logo após os `<script>` do jsPDF/jspdf-autotable)

**Interfaces:**
- Produces: global `firebase` (namespace do SDK compat) disponível para todos os `<script>` classicos seguintes; `const firebaseConfig` inicializado via `firebase.initializeApp(firebaseConfig)`.

- [ ] **Step 1: Adicionar os `<script src>` do Firebase e o bloco de configuração**

Localizar (linha 14 do arquivo atual):
```html
  <script src="https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js"></script>
```

Inserir logo depois:
```html
  <script src="https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/12.16.0/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore-compat.js"></script>
  <script>
    // ==================== CONFIGURAÇÃO DO FIREBASE — COLE AQUI ====================
    // Substitua os valores abaixo pelos do seu projeto (ver README.md, seção
    // "Configuração do Firebase"). Estas chaves não são segredas — são
    // identificadores públicos do projeto; a segurança real vem das regras
    // do Firestore (firestore.rules), não de esconder esta configuração.
    const firebaseConfig = {
      apiKey: "SUBSTITUA_AQUI",
      authDomain: "SUBSTITUA_AQUI.firebaseapp.com",
      projectId: "SUBSTITUA_AQUI",
      storageBucket: "SUBSTITUA_AQUI.appspot.com",
      messagingSenderId: "SUBSTITUA_AQUI",
      appId: "SUBSTITUA_AQUI",
    };
    firebase.initializeApp(firebaseConfig);
  </script>
```

- [ ] **Step 2: Verificar que os 3 arquivos do CDN existem na versão fixada**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js"
curl -s -o /dev/null -w "%{http_code}\n" "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth-compat.js"
curl -s -o /dev/null -w "%{http_code}\n" "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore-compat.js"
```
Expected: `200` nas três linhas.

- [ ] **Step 3: Verificar que a página carrega sem erros com a config placeholder (o SDK inicializa mesmo com chaves falsas; só falha quando algo tenta *usar* a rede)**

Run (via Bash, headless Chrome + CDP — mesmo padrão de scripts anteriores desta sessão):
```bash
cat > "/c/Users/tpanz/AppData/Local/Temp/claude/C--Users-tpanz/79878f48-c867-45f4-b9ba-5acd963d7614/scratchpad/verify-firebase-sdk-load.mjs" <<'EOF'
import { spawn } from "node:child_process";
import fs from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = "file:///C:/Users/tpanz/vet-dashboard/index.html";
const PROFILE = "C:/Users/tpanz/AppData/Local/Temp/claude-chrome-profile-fb-sdk-v1";

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9460", `--user-data-dir=${PROFILE}`, "--window-size=1200,900", URL], { stdio: "ignore" });
  try {
    for (let i = 0; i < 60; i++) {
      try { const res = await fetch("http://127.0.0.1:9460/json/version"); if (res.ok) break; } catch {}
      await sleep(500);
    }
    const targets = await (await fetch("http://127.0.0.1:9460/json")).json();
    const target = targets.find((t) => t.url.includes("index.html"));
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.addEventListener("open", resolve));
    let msgId = 0;
    const pending = new Map();
    const errors = [];
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
      if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.text);
      if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
    });
    function send(method, params = {}) {
      const id = ++msgId;
      return new Promise((resolve) => { pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
    }
    async function evaluate(expression) {
      const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      return res.result?.result?.value;
    }
    await send("Page.enable");
    await send("Runtime.enable");
    await sleep(2000);
    const hasFirebase = await evaluate("typeof firebase !== 'undefined' && typeof firebase.firestore === 'function' && typeof firebase.auth === 'function'");
    console.log(hasFirebase ? "PASS - SDK do Firebase carregado (firebase.firestore/firebase.auth existem)" : "FAIL - SDK do Firebase não carregou");
    console.log("--- erros de console/exceptions capturados ---");
    console.log(errors.length ? errors : "nenhum");
    ws.close();
  } finally {
    try { chrome.kill(); } catch {}
    await sleep(500);
  }
}
main().catch(console.error);
EOF
node "/c/Users/tpanz/AppData/Local/Temp/claude/C--Users-tpanz/79878f48-c867-45f4-b9ba-5acd963d7614/scratchpad/verify-firebase-sdk-load.mjs"
```
Expected: `PASS - SDK do Firebase carregado` e `erros ... nenhum`.

---

### Task 3: Reescrever o módulo `state` para Firestore multi-organização em tempo real

**Files:**
- Modify: `C:\Users\tpanz\vet-dashboard\index.html:1224-1498` (todo o corpo do módulo `DuoVet.state`)

**Interfaces:**
- Consumes: `DuoVet.utils.generateId()`, `DuoVet.utils.nextPaletteVar(n)` (já existentes); global `firebase` (da Task 2).
- Produces (API pública do módulo, chamada pelos demais módulos e pela Task 4):
  - `subscribe(callback)` → função `unsubscribe` (**inalterado**)
  - `isReady()` → `boolean` (**novo**)
  - `getConnectionError()` → `string | null` (**novo**)
  - `startSync(orgId: string)` → `void` (**novo** — liga a sincronização em tempo real daquela organização)
  - `stopSync()` → `void` (**novo** — desliga listeners e zera os arrays locais)
  - `getCategories/addCategory/updateCategory/removeCategory`, `getEventTypes/addEventType/removeEventType`, `getTransactions/addTransaction/removeTransaction`, `getAppointments/addAppointment/removeAppointment`, `getDespesas/addDespesa/removeDespesa`, `getPatients/addPatient/updatePatient/removePatient/toggleInternado/toggleObito/addConsulta/removeConsulta/addVacina/removeVacina/addVermifugo/removeVermifugo` (**mesmas assinaturas de hoje** — só o interior muda de `localStorage` para Firestore).

- [ ] **Step 1: Substituir o corpo inteiro do módulo `state`**

Localizar o bloco atual (linhas 1224-1498, começando em `DuoVet.state = (function () {` e terminando em `})();` antes de `</script>`) e substituir por:

```js
DuoVet.state = (function () {
  const { generateId, nextPaletteVar } = DuoVet.utils;

  let db = null;
  let orgId = null;

  const COLLECTIONS = ["categories", "eventTypes", "transactions", "appointments", "despesas", "patients"];
  let categories = [];
  let eventTypes = [];
  let transactions = [];
  let appointments = [];
  let despesas = [];
  let patients = [];

  const ready = { categories: false, eventTypes: false, transactions: false, appointments: false, despesas: false, patients: false };
  let connectionError = null;
  let unsubscribers = [];
  let listeners = [];

  // ---- Pub/Sub ---------------------------------------------------------------
  function subscribe(callback) {
    listeners.push(callback);
    return function unsubscribe() {
      listeners = listeners.filter((l) => l !== callback);
    };
  }

  function notify() {
    listeners.forEach((callback) => callback());
  }

  function isReady() {
    return COLLECTIONS.every((name) => ready[name]);
  }

  function getConnectionError() {
    return connectionError;
  }

  // ---- Firestore: sincronização em tempo real, escopada por organização ------
  function orgCollection(name) {
    return db.collection("organizations").doc(orgId).collection(name);
  }

  function fromFirestoreDate(value) {
    if (!value) return value;
    return typeof value.toDate === "function" ? value.toDate() : new Date(value);
  }

  function revivePatient(p) {
    return {
      ...p,
      consultas: (p.consultas || []).map((c) => ({ ...c, data: fromFirestoreDate(c.data) })),
      vacinas: (p.vacinas || []).map((v) => ({
        ...v,
        data: fromFirestoreDate(v.data),
        proximaDose: v.proximaDose ? fromFirestoreDate(v.proximaDose) : null,
      })),
      vermifugos: (p.vermifugos || []).map((v) => ({ ...v, data: fromFirestoreDate(v.data) })),
    };
  }

  async function seedIfEmpty(name, defaults) {
    const snap = await orgCollection(name).limit(1).get();
    if (!snap.empty) return;
    const batch = db.batch();
    defaults.forEach((entry) => batch.set(orgCollection(name).doc(), entry));
    await batch.commit();
  }

  function attachCollection(name, setter, revive) {
    const unsub = orgCollection(name).onSnapshot(
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => {
          const data = { id: doc.id, ...doc.data() };
          return revive ? revive(data) : data;
        });
        setter(docs);
        ready[name] = true;
        connectionError = null;
        notify();
      },
      (error) => {
        console.error(`DuoVet: erro ao sincronizar '${name}'.`, error);
        connectionError = "Sem conexão — verifique sua internet e recarregue a página.";
        notify();
      }
    );
    unsubscribers.push(unsub);
  }

  function startSync(newOrgId) {
    orgId = newOrgId;
    db = firebase.firestore();

    attachCollection("categories", (docs) => { categories = docs; });
    attachCollection("eventTypes", (docs) => { eventTypes = docs; });
    attachCollection("transactions", (docs) => { transactions = docs; }, (t) => ({ ...t, data: fromFirestoreDate(t.data) }));
    attachCollection("appointments", (docs) => { appointments = docs; }, (a) => ({ ...a, data: fromFirestoreDate(a.data) }));
    attachCollection("despesas", (docs) => { despesas = docs; }, (d) => ({ ...d, data: fromFirestoreDate(d.data) }));
    attachCollection("patients", (docs) => { patients = docs; }, revivePatient);

    seedIfEmpty("categories", [
      { nome: "Consulta", colorVar: nextPaletteVar(0), valorPadrao: 0, custoPadrao: 0 },
      { nome: "Aplicação de Vacina/Medicação", colorVar: nextPaletteVar(1), valorPadrao: 0, custoPadrao: 0 },
      { nome: "Cirurgia", colorVar: nextPaletteVar(2), valorPadrao: 0, custoPadrao: 0 },
      { nome: "Venda de Remédio", colorVar: nextPaletteVar(3), valorPadrao: 0, custoPadrao: 0 },
    ]);
    seedIfEmpty("eventTypes", [
      { nome: "Cirurgia", colorVar: "--red" },
      { nome: "Retorno", colorVar: "--blue" },
      { nome: "Tarefa Importante", colorVar: "--amber" },
    ]);
  }

  function stopSync() {
    unsubscribers.forEach((unsub) => unsub());
    unsubscribers = [];
    orgId = null;
    categories = [];
    eventTypes = [];
    transactions = [];
    appointments = [];
    despesas = [];
    patients = [];
    COLLECTIONS.forEach((name) => { ready[name] = false; });
    notify();
  }

  // ---- API: categorias --------------------------------------------------------
  function getCategories() { return categories.slice(); }
  function addCategory(entry) { orgCollection("categories").add({ colorVar: nextPaletteVar(categories.length), ...entry }); }
  function updateCategory(id, entry) { orgCollection("categories").doc(id).update(entry); }
  function removeCategory(id) { orgCollection("categories").doc(id).delete(); }

  // ---- API: tipos de evento ----------------------------------------------------
  function getEventTypes() { return eventTypes.slice(); }
  function addEventType(nome) { orgCollection("eventTypes").add({ nome, colorVar: nextPaletteVar(eventTypes.length) }); }
  function removeEventType(id) { orgCollection("eventTypes").doc(id).delete(); }

  // ---- API: transações ---------------------------------------------------
  function getTransactions() { return transactions.slice(); }
  function addTransaction(entry) {
    orgCollection("transactions").add({ lucro: entry.valorBruto - entry.custo, ...entry });
  }
  function removeTransaction(id) { orgCollection("transactions").doc(id).delete(); }

  // ---- API: agenda -----------------------------------------------------------
  function getAppointments() { return appointments.slice(); }
  function addAppointment(entry) { orgCollection("appointments").add(entry); }
  function removeAppointment(id) { orgCollection("appointments").doc(id).delete(); }

  // ---- API: despesas ---------------------------------------------------------
  function getDespesas() { return despesas.slice(); }
  function addDespesa(entry) { orgCollection("despesas").add(entry); }
  function removeDespesa(id) { orgCollection("despesas").doc(id).delete(); }

  // ---- API: pacientes ---------------------------------------------------------
  function getPatients() { return patients.slice(); }
  function addPatient(entry) {
    orgCollection("patients").add({ consultas: [], vacinas: [], vermifugos: [], internado: false, obito: false, ...entry });
  }
  function updatePatient(id, entry) { orgCollection("patients").doc(id).update(entry); }
  function removePatient(id) { orgCollection("patients").doc(id).delete(); }

  function toggleInternado(id) {
    const p = patients.find((p) => p.id === id);
    if (p) orgCollection("patients").doc(id).update({ internado: !p.internado });
  }

  function toggleObito(id) {
    const p = patients.find((p) => p.id === id);
    if (p) orgCollection("patients").doc(id).update({ obito: !p.obito });
  }

  function addConsulta(patientId, entry) {
    const p = patients.find((p) => p.id === patientId);
    if (!p) return;
    orgCollection("patients").doc(patientId).update({ consultas: [...p.consultas, { id: generateId(), ...entry }] });
  }

  function removeConsulta(patientId, consultaId) {
    const p = patients.find((p) => p.id === patientId);
    if (!p) return;
    orgCollection("patients").doc(patientId).update({ consultas: p.consultas.filter((c) => c.id !== consultaId) });
  }

  function addVacina(patientId, entry) {
    const p = patients.find((p) => p.id === patientId);
    if (!p) return;
    orgCollection("patients").doc(patientId).update({ vacinas: [...p.vacinas, { id: generateId(), ...entry }] });
  }

  function removeVacina(patientId, vacinaId) {
    const p = patients.find((p) => p.id === patientId);
    if (!p) return;
    orgCollection("patients").doc(patientId).update({ vacinas: p.vacinas.filter((v) => v.id !== vacinaId) });
  }

  function addVermifugo(patientId, entry) {
    const p = patients.find((p) => p.id === patientId);
    if (!p) return;
    orgCollection("patients").doc(patientId).update({ vermifugos: [...p.vermifugos, { id: generateId(), ...entry }] });
  }

  function removeVermifugo(patientId, vermifugoId) {
    const p = patients.find((p) => p.id === patientId);
    if (!p) return;
    orgCollection("patients").doc(patientId).update({ vermifugos: p.vermifugos.filter((v) => v.id !== vermifugoId) });
  }

  return {
    subscribe,
    isReady,
    getConnectionError,
    startSync,
    stopSync,
    getCategories,
    addCategory,
    updateCategory,
    removeCategory,
    getEventTypes,
    addEventType,
    removeEventType,
    getTransactions,
    addTransaction,
    removeTransaction,
    getAppointments,
    addAppointment,
    removeAppointment,
    getDespesas,
    addDespesa,
    removeDespesa,
    getPatients,
    addPatient,
    updatePatient,
    removePatient,
    toggleInternado,
    toggleObito,
    addConsulta,
    removeConsulta,
    addVacina,
    removeVacina,
    addVermifugo,
    removeVermifugo,
  };
})();
```

- [ ] **Step 2: Verificar sintaxe do módulo**

Run:
```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('C:/Users/tpanz/vet-dashboard/index.html', 'utf8');
const start = html.indexOf('DuoVet.state = (function () {');
const end = html.indexOf('</script>', start);
const code = html.slice(start, end);
try { new Function(code); console.log('PASS - sintaxe válida'); }
catch (e) { console.log('FAIL -', e.message); process.exit(1); }
"
```
Expected: `PASS - sintaxe válida`

---

### Task 4: Reescrever o módulo `auth` (Firebase Authentication multi-organização) e o overlay de login

**Files:**
- Modify: `C:\Users\tpanz\vet-dashboard\index.html:1015-1060` (markup do overlay de login e remoção do modal "Gerenciar veterinários")
- Modify: `C:\Users\tpanz\vet-dashboard\index.html:1509-1678` (corpo do módulo `DuoVet.auth`)
- Modify: `C:\Users\tpanz\vet-dashboard\index.html` (CSS — adicionar estilos do campo `auth-org-field`, se necessário; os demais já existem)

**Interfaces:**
- Consumes: `DuoVet.state.startSync(orgId)`, `DuoVet.state.stopSync()` (produzidos na Task 3); global `firebase`.
- Produces: `isLoggedIn()` → `boolean`; `getSessionVet()` → `{ uid, nome, email, orgId } | null`; `logout()` → `Promise`; `init()` → `void`; `openLoginOverlay(onSuccess)` → `void` (**assinatura muda**: não recebe mais `onCancel`, já que não há mais cancelamento).

- [ ] **Step 1: Substituir o markup do overlay de login e remover o modal "Gerenciar veterinários"**

Localizar o bloco atual (linhas 1015-1060, do comentário `<!-- ==================== OVERLAY: LOGIN DO VETERINÁRIO ==================== -->` até o fechamento do `#modal-gerenciar-vets`) e substituir por:

```html
  <!-- ==================== OVERLAY: LOGIN OBRIGATÓRIO ==================== -->
  <div id="auth-overlay" class="auth-overlay">
    <div class="auth-box">
      <div class="auth-icon"><i class="ti ti-lock"></i></div>
      <h3>Acesso à Clínica</h3>
      <p class="auth-sub">Entre com seu email e senha para acessar o sistema.</p>
      <form id="form-auth-login" data-mode="login">
        <div class="fl hidden" id="auth-nome-field">
          <label>Nome</label>
          <input id="auth-nome" type="text" placeholder="Ex: Dr. Fulano" />
        </div>
        <div class="fl hidden" id="auth-org-field">
          <label>Código da clínica</label>
          <input id="auth-org" type="text" placeholder="Ex: duovet" />
        </div>
        <div class="fl">
          <label>Email</label>
          <input id="auth-email" type="email" required autocomplete="username" />
        </div>
        <div class="fl">
          <label>Senha</label>
          <input id="auth-senha" type="password" required autocomplete="current-password" />
        </div>
        <div id="auth-error" class="auth-error hidden"></div>
        <div class="auth-actions">
          <button type="submit" id="auth-submit-btn" class="btn-p full"><i class="ti ti-login"></i> Entrar</button>
        </div>
      </form>
      <button type="button" id="auth-toggle-link" class="link-btn">Não tem conta? Criar conta</button>
    </div>
  </div>

  <!-- ==================== SINCRONIZAÇÃO: CARREGANDO / ERRO ==================== -->
  <div id="app-loading-overlay" class="auth-overlay hidden">
    <div class="auth-box">
      <div class="auth-icon"><i class="ti ti-loader-2"></i></div>
      <h3>Carregando...</h3>
      <p class="auth-sub">Sincronizando os dados da clínica.</p>
    </div>
  </div>
  <div id="app-connection-error" class="alert alert-warn hidden">
    <i class="ti ti-alert-triangle"></i>
    <span>Sem conexão — verifique sua internet e recarregue a página.</span>
  </div>
```

Note: o `#auth-overlay` **não** começa com a classe `hidden` (era `class="auth-overlay hidden"`, agora é só `class="auth-overlay"`) — ele é a tela padrão até o JS confirmar que há sessão ativa.

Adicionar a seguinte regra de CSS logo após a regra `#auth-manage-link{...}` existente (dentro do bloco `<style id="duovet-styles">`, procurar a linha com `.pac-logged-bar{`):

```css
#app-connection-error{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:250;}
```

- [ ] **Step 2: Substituir o corpo do módulo `auth`**

Localizar o bloco atual (linhas 1509-1678, `DuoVet.auth = (function () {` até `})();`) e substituir por:

```js
DuoVet.auth = (function () {
  let sessionVet = null; // { uid, nome, email, orgId } | null
  let pendingOnSuccess = null;

  function isLoggedIn() {
    return sessionVet !== null;
  }

  function getSessionVet() {
    return sessionVet;
  }

  function login(email, senha) {
    return firebase.auth().signInWithEmailAndPassword(email, senha);
  }

  function signup(nome, email, senha, signupOrgId) {
    return firebase.auth().createUserWithEmailAndPassword(email, senha).then((cred) => {
      return firebase.firestore().collection("users").doc(cred.user.uid).set({ nome, email, orgId: signupOrgId });
    });
  }

  function logout() {
    return firebase.auth().signOut();
  }

  // ---- UI do overlay de login/cadastro -------------------------------------------------
  function openLoginOverlay(onSuccess) {
    pendingOnSuccess = onSuccess || null;
    const form = document.getElementById("form-auth-login");
    form.reset();
    form.dataset.mode = "login";
    document.getElementById("auth-nome-field").classList.add("hidden");
    document.getElementById("auth-org-field").classList.add("hidden");
    document.getElementById("auth-submit-btn").textContent = "Entrar";
    document.getElementById("auth-toggle-link").textContent = "Não tem conta? Criar conta";
    document.getElementById("auth-error").classList.add("hidden");
    document.getElementById("auth-overlay").classList.remove("hidden");
    document.getElementById("auth-email").focus();
  }

  function closeLoginOverlay() {
    document.getElementById("auth-overlay").classList.add("hidden");
  }

  function showAuthError(message) {
    const el = document.getElementById("auth-error");
    el.textContent = message;
    el.classList.remove("hidden");
  }

  function mapAuthError(error) {
    if (error.code === "auth/email-already-in-use") return "Este email já tem uma conta. Tente entrar.";
    if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/user-not-found") return "Email ou senha incorretos.";
    if (error.code === "auth/weak-password") return "A senha precisa ter pelo menos 6 caracteres.";
    if (error.code === "auth/invalid-email") return "Email inválido.";
    if (error.code === "permission-denied" || error.code === "auth/permission-denied") return "Código da clínica inválido, ou este email não está autorizado. Fale com o administrador.";
    return "Não foi possível concluir. Tente novamente.";
  }

  function handleAuthSubmit(event) {
    event.preventDefault();
    const form = document.getElementById("form-auth-login");
    const email = document.getElementById("auth-email").value.trim();
    const senha = document.getElementById("auth-senha").value;
    document.getElementById("auth-error").classList.add("hidden");

    if (form.dataset.mode === "signup") {
      const nome = document.getElementById("auth-nome").value.trim();
      const signupOrgId = document.getElementById("auth-org").value.trim().toLowerCase();
      if (!nome || !signupOrgId) {
        showAuthError("Preencha nome e código da clínica.");
        return;
      }
      signup(nome, email, senha, signupOrgId).catch((error) => showAuthError(mapAuthError(error)));
    } else {
      login(email, senha).catch((error) => showAuthError(mapAuthError(error)));
    }
  }

  function handleToggleMode(event) {
    event.preventDefault();
    const form = document.getElementById("form-auth-login");
    const goingToSignup = form.dataset.mode !== "signup";
    form.dataset.mode = goingToSignup ? "signup" : "login";
    document.getElementById("auth-nome-field").classList.toggle("hidden", !goingToSignup);
    document.getElementById("auth-org-field").classList.toggle("hidden", !goingToSignup);
    document.getElementById("auth-submit-btn").textContent = goingToSignup ? "Criar conta" : "Entrar";
    document.getElementById("auth-toggle-link").textContent = goingToSignup ? "Já tem conta? Entrar" : "Não tem conta? Criar conta";
    document.getElementById("auth-error").classList.add("hidden");
  }

  function init() {
    document.getElementById("form-auth-login").addEventListener("submit", handleAuthSubmit);
    document.getElementById("auth-toggle-link").addEventListener("click", handleToggleMode);

    firebase.auth().onAuthStateChanged((user) => {
      if (!user) {
        sessionVet = null;
        DuoVet.state.stopSync();
        document.dispatchEvent(new CustomEvent("duovet:authchanged"));
        return;
      }
      firebase.firestore().collection("users").doc(user.uid).get().then((doc) => {
        if (!doc.exists) {
          // Conta criada no Firebase Auth mas sem perfil (não estava na
          // allowlist de nenhuma organização) — sem acesso a dado nenhum.
          sessionVet = null;
          DuoVet.state.stopSync();
          document.dispatchEvent(new CustomEvent("duovet:authchanged"));
          return;
        }
        const data = doc.data();
        sessionVet = { uid: user.uid, nome: data.nome, email: data.email, orgId: data.orgId };
        DuoVet.state.startSync(data.orgId);
        closeLoginOverlay();
        document.dispatchEvent(new CustomEvent("duovet:authchanged"));
        const callback = pendingOnSuccess;
        pendingOnSuccess = null;
        if (callback) callback();
      });
    });
  }

  return { isLoggedIn, getSessionVet, logout, init, openLoginOverlay };
})();
```

- [ ] **Step 3: Verificar sintaxe do módulo**

Run:
```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('C:/Users/tpanz/vet-dashboard/index.html', 'utf8');
const start = html.indexOf('DuoVet.auth = (function () {');
const end = html.indexOf('</script>', start);
const code = html.slice(start, end);
try { new Function(code); console.log('PASS - sintaxe válida'); }
catch (e) { console.log('FAIL -', e.message); process.exit(1); }
"
```
Expected: `PASS - sintaxe válida`

- [ ] **Step 4: Verificar via CDP que o formulário alterna entre login/cadastro e mostra erro de rede sem travar (sem projeto Firebase real ainda — a config é o placeholder da Task 2, então a chamada de fato falha, mas de forma tratada)**

Run:
```bash
cat > "/c/Users/tpanz/AppData/Local/Temp/claude/C--Users-tpanz/79878f48-c867-45f4-b9ba-5acd963d7614/scratchpad/verify-auth-rewrite.mjs" <<'EOF'
import { spawn } from "node:child_process";
import fs from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = "file:///C:/Users/tpanz/vet-dashboard/index.html";
const PROFILE = "C:/Users/tpanz/AppData/Local/Temp/claude-chrome-profile-auth-rewrite-v1";

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function ok(label, cond) { console.log(`${cond ? "PASS" : "FAIL"} - ${label}`); return cond; }

async function main() {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9461", `--user-data-dir=${PROFILE}`, "--window-size=1200,900", URL], { stdio: "ignore" });
  try {
    for (let i = 0; i < 60; i++) {
      try { const res = await fetch("http://127.0.0.1:9461/json/version"); if (res.ok) break; } catch {}
      await sleep(500);
    }
    const targets = await (await fetch("http://127.0.0.1:9461/json")).json();
    const target = targets.find((t) => t.url.includes("index.html"));
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.addEventListener("open", resolve));
    let msgId = 0;
    const pending = new Map();
    const errors = [];
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
      if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.text);
      if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
    });
    function send(method, params = {}) {
      const id = ++msgId;
      return new Promise((resolve) => { pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
    }
    async function evaluate(expression) {
      const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      return res.result?.result?.value;
    }
    await send("Page.enable");
    await send("Runtime.enable");
    await sleep(2000);

    ok("Overlay de login visível por padrão (app inteiro protegido)", (await evaluate('!document.getElementById("auth-overlay").classList.contains("hidden")')) === true);
    ok("Campo de nome escondido no modo login", (await evaluate('document.getElementById("auth-nome-field").classList.contains("hidden")')) === true);

    await evaluate('document.getElementById("auth-toggle-link").click()');
    await sleep(150);
    ok("Alterna para cadastro: campo nome aparece", (await evaluate('!document.getElementById("auth-nome-field").classList.contains("hidden")')) === true);
    ok("Alterna para cadastro: campo código da clínica aparece", (await evaluate('!document.getElementById("auth-org-field").classList.contains("hidden")')) === true);
    ok("Botão vira 'Criar conta'", (await evaluate('document.getElementById("auth-submit-btn").textContent')) === "Criar conta");

    await evaluate('document.getElementById("auth-nome").value = "Dr. Teste"');
    await evaluate('document.getElementById("auth-org").value = "duovet"');
    await evaluate('document.getElementById("auth-email").value = "teste@duovet.com"');
    await evaluate('document.getElementById("auth-senha").value = "senha123"');
    await evaluate('document.getElementById("form-auth-login").dispatchEvent(new Event("submit", {cancelable:true}))');
    await sleep(1500);

    ok("Erro de cadastro aparece (config placeholder não é um projeto real) sem travar a página", (await evaluate('!document.getElementById("auth-error").classList.contains("hidden")')) === true);
    ok("Overlay continua visível (cadastro não foi concluído)", (await evaluate('!document.getElementById("auth-overlay").classList.contains("hidden")')) === true);

    await evaluate('document.getElementById("auth-toggle-link").click()');
    await sleep(150);
    ok("Alterna de volta para login: campo nome some", (await evaluate('document.getElementById("auth-nome-field").classList.contains("hidden")')) === true);

    console.log("--- erros de console/exceptions capturados ---");
    console.log(errors.length ? errors : "nenhum");
    ws.close();
  } finally {
    try { chrome.kill(); } catch {}
    await sleep(500);
  }
}
main().catch(console.error);
EOF
node "/c/Users/tpanz/AppData/Local/Temp/claude/C--Users-tpanz/79878f48-c867-45f4-b9ba-5acd963d7614/scratchpad/verify-auth-rewrite.mjs"
```
Expected: todas as linhas `PASS`, e a lista de erros capturados deve conter apenas o erro de rede do Firebase esperado (ex: `auth/invalid-api-key` ou similar) — não deve haver `TypeError`/`ReferenceError` do nosso próprio código. Se aparecer um erro do tipo `Cannot read properties of undefined` ou `is not a function`, é um bug real no código e deve ser corrigido antes de prosseguir.

---

### Task 5: Portão de login global, cabeçalho "logado como / Sair" e estados de carregamento/erro

**Files:**
- Modify: `C:\Users\tpanz\vet-dashboard\index.html:443-447` (`.tn-foot` do cabeçalho)
- Modify: `C:\Users\tpanz\vet-dashboard\index.html:3809-3827` (`initNav()` do módulo `main`)
- Modify: `C:\Users\tpanz\vet-dashboard\index.html:3871-3890` (`DOMContentLoaded` do módulo `main`)
- Modify: `C:\Users\tpanz\vet-dashboard\index.html` (CSS — nova regra `.header-auth`)

**Interfaces:**
- Consumes: `DuoVet.auth.isLoggedIn()`, `DuoVet.auth.getSessionVet()`, `DuoVet.auth.logout()`, `DuoVet.auth.openLoginOverlay(onSuccess)` (Task 4); `DuoVet.state.isReady()`, `DuoVet.state.getConnectionError()`, `DuoVet.state.subscribe(callback)` (Task 3); evento customizado `document` `"duovet:authchanged"` (disparado pelo `auth.init()` na Task 4).

- [ ] **Step 1: Adicionar o bloco "logado como / Sair" no cabeçalho**

Localizar:
```html
    <div class="tn-foot">
      <button id="theme-toggle" type="button" class="theme-toggle" aria-label="Alternar tema claro/escuro">
        <i class="ti ti-moon" id="theme-icon"></i>
      </button>
    </div>
```

Substituir por:
```html
    <div class="tn-foot">
      <div id="header-auth" class="header-auth hidden">
        <span>Logado: <strong id="header-auth-nome"></strong></span>
        <button type="button" id="btn-logout" class="link-btn"><i class="ti ti-logout"></i> Sair</button>
      </div>
      <button id="theme-toggle" type="button" class="theme-toggle" aria-label="Alternar tema claro/escuro">
        <i class="ti ti-moon" id="theme-icon"></i>
      </button>
    </div>
```

Adicionar a seguinte regra de CSS (mesmo bloco `<style id="duovet-styles">`, próximo à regra `.pac-logged-bar{`):
```css
.header-auth{display:flex;align-items:center;gap:.6rem;font-size:12.5px;color:var(--t2);margin-right:.75rem;}
.header-auth strong{color:var(--t1);}
```

- [ ] **Step 2: Remover o gate por aba em `initNav()` e adicionar o portão global**

Primeiro, atualizar o comentário de topo do módulo (linhas 3781-3786), que hoje diz que só "pacientes" é protegida — isso deixa de ser verdade:

Localizar:
```js
// main.js — ponto de entrada: liga a navegação entre abas e inicializa os
// módulos. Também centraliza a inscrição no state: qualquer mudança nos dados
// (nova venda, serviço editado, evento agendado) recalcula todas as telas
// que dependem daquele dado, simulando atualização "em tempo real". A aba
// "pacientes" é a única protegida por login (DuoVet.auth) — clicar nela sem
// sessão ativa abre o overlay de identificação em vez de trocar de aba.
```

Substituir por:
```js
// main.js — ponto de entrada: liga a navegação entre abas e inicializa os
// módulos. Também centraliza a inscrição no state: qualquer mudança nos dados
// (nova venda, serviço editado, evento agendado) recalcula todas as telas
// que dependem daquele dado, propagada em tempo real pelo Firestore. O login
// (DuoVet.auth) protege o app inteiro: sem sessão ativa, o overlay cobre
// todas as abas até o veterinário entrar ou criar conta.
```

Agora, localizar (dentro do módulo `main`):
```js
  function initNav() {
    document.querySelectorAll(".nav-btn[data-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.tab;
        if (target === "pacientes" && !DuoVet.auth.isLoggedIn()) {
          DuoVet.auth.openLoginOverlay(() => {
            switchTab("pacientes");
            DuoVet.pacientes.render();
          });
          return;
        }
        switchTab(target);
      });
    });
    // Atalhos dentro do conteúdo (ex: botão do card hero) que levam a outra aba.
    document.querySelectorAll("[data-tab-link]").forEach((el) => {
      el.addEventListener("click", () => switchTab(el.dataset.tabLink));
    });
  }
```

Substituir por:
```js
  function initNav() {
    // O login agora protege o app inteiro (não só Pacientes) — todas as abas
    // ficam livres para trocar entre si; o portão fica só na inicialização.
    document.querySelectorAll(".nav-btn[data-tab]").forEach((button) => {
      button.addEventListener("click", () => switchTab(button.dataset.tab));
    });
    // Atalhos dentro do conteúdo (ex: botão do card hero) que levam a outra aba.
    document.querySelectorAll("[data-tab-link]").forEach((el) => {
      el.addEventListener("click", () => switchTab(el.dataset.tabLink));
    });
  }

  function updateAuthGate() {
    const loggedIn = DuoVet.auth.isLoggedIn();
    document.getElementById("header-auth").classList.toggle("hidden", !loggedIn);
    if (loggedIn) {
      document.getElementById("header-auth-nome").textContent = DuoVet.auth.getSessionVet().nome;
    }
  }

  function updateSyncState() {
    const loggedIn = DuoVet.auth.isLoggedIn();
    document.getElementById("app-loading-overlay").classList.toggle("hidden", !loggedIn || DuoVet.state.isReady());
    const error = DuoVet.state.getConnectionError();
    document.getElementById("app-connection-error").classList.toggle("hidden", !loggedIn || !error);
  }
```

- [ ] **Step 3: Ligar o portão global e os novos listeners no `DOMContentLoaded`**

Localizar:
```js
  document.addEventListener("DOMContentLoaded", () => {
    initNav();
    initTheme();
    renderHeaderDate();
    DuoVet.form.init();
    DuoVet.servicesView.init();
    DuoVet.despesas.init();
    DuoVet.historico.init();
    DuoVet.calendar.init();
    DuoVet.pacientes.init();
    DuoVet.auth.init();
    DuoVet.relatorio.init();

    // Única inscrição central no pub/sub do state — evita cada módulo se
    // inscrever individualmente e todos ficam sincronizados entre si.
    DuoVet.state.subscribe(renderAll);

    DuoVet.dashboard.render();
    switchTab("dashboard");
```

Substituir por:
```js
  document.addEventListener("DOMContentLoaded", () => {
    initNav();
    initTheme();
    renderHeaderDate();
    DuoVet.form.init();
    DuoVet.servicesView.init();
    DuoVet.despesas.init();
    DuoVet.historico.init();
    DuoVet.calendar.init();
    DuoVet.pacientes.init();
    DuoVet.auth.init();
    DuoVet.relatorio.init();

    document.getElementById("btn-logout").addEventListener("click", () => DuoVet.auth.logout());
    document.addEventListener("duovet:authchanged", () => {
      updateAuthGate();
      updateSyncState();
    });

    // Única inscrição central no pub/sub do state — evita cada módulo se
    // inscrever individualmente e todos ficam sincronizados entre si.
    DuoVet.state.subscribe(() => {
      updateSyncState();
      renderAll();
    });

    DuoVet.dashboard.render();
    switchTab("dashboard");
```

- [ ] **Step 4: Verificar sintaxe do módulo `main`**

O módulo `main` é uma IIFE anônima (não `DuoVet.main = (function...)`), identificada pelo comentário `// main.js — ponto de entrada`. Run:
```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('C:/Users/tpanz/vet-dashboard/index.html', 'utf8');
const start = html.indexOf('// main.js — ponto de entrada');
const end = html.indexOf('</script>', start);
const code = html.slice(start, end);
try { new Function(code); console.log('PASS - sintaxe válida'); }
catch (e) { console.log('FAIL -', e.message); process.exit(1); }
"
```
Expected: `PASS - sintaxe válida`

- [ ] **Step 5: Verificar via CDP que o portão global cobre todas as abas**

Run:
```bash
cat > "/c/Users/tpanz/AppData/Local/Temp/claude/C--Users-tpanz/79878f48-c867-45f4-b9ba-5acd963d7614/scratchpad/verify-global-gate.mjs" <<'EOF'
import { spawn } from "node:child_process";
import fs from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = "file:///C:/Users/tpanz/vet-dashboard/index.html";
const PROFILE = "C:/Users/tpanz/AppData/Local/Temp/claude-chrome-profile-global-gate-v1";

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function ok(label, cond) { console.log(`${cond ? "PASS" : "FAIL"} - ${label}`); return cond; }

async function main() {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9462", `--user-data-dir=${PROFILE}`, "--window-size=1200,900", URL], { stdio: "ignore" });
  try {
    for (let i = 0; i < 60; i++) {
      try { const res = await fetch("http://127.0.0.1:9462/json/version"); if (res.ok) break; } catch {}
      await sleep(500);
    }
    const targets = await (await fetch("http://127.0.0.1:9462/json")).json();
    const target = targets.find((t) => t.url.includes("index.html"));
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.addEventListener("open", resolve));
    let msgId = 0;
    const pending = new Map();
    const errors = [];
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
      if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.text);
      if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
    });
    function send(method, params = {}) {
      const id = ++msgId;
      return new Promise((resolve) => { pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
    }
    async function evaluate(expression) {
      const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      return res.result?.result?.value;
    }
    await send("Page.enable");
    await send("Runtime.enable");
    await sleep(2000);

    ok("Barra 'logado como' escondida antes do login", (await evaluate('document.getElementById("header-auth").classList.contains("hidden")')) === true);
    ok("Overlay de login cobre a tela ao abrir o site", (await evaluate('!document.getElementById("auth-overlay").classList.contains("hidden")')) === true);

    await evaluate('document.querySelector(\'.nav-btn[data-tab="gastos"]\').click()');
    await sleep(150);
    ok("Trocar de aba não fecha o overlay (continua deslogado)", (await evaluate('!document.getElementById("auth-overlay").classList.contains("hidden")')) === true);

    console.log("--- erros de console/exceptions capturados ---");
    console.log(errors.length ? errors : "nenhum");
    ws.close();
  } finally {
    try { chrome.kill(); } catch {}
    await sleep(500);
  }
}
main().catch(console.error);
EOF
node "/c/Users/tpanz/AppData/Local/Temp/claude/C--Users-tpanz/79878f48-c867-45f4-b9ba-5acd963d7614/scratchpad/verify-global-gate.mjs"
```
Expected: todas as linhas `PASS`, sem erros de console.

---

### Task 6: Atualizar o módulo `pacientes` (remover a barra local de login, `vet.id` → `vet.uid`)

**Files:**
- Modify: `C:\Users\tpanz\vet-dashboard\index.html:780-783` (markup `.pac-logged-bar` dentro da aba Pacientes)
- Modify: `C:\Users\tpanz\vet-dashboard\index.html:2891-2896` (`renderLoggedBar` no módulo `pacientes`)
- Modify: `C:\Users\tpanz\vet-dashboard\index.html:2913-2917` (`visiblePatients`)
- Modify: `C:\Users\tpanz\vet-dashboard\index.html:3090-3098` (`handleSubmitPaciente`)
- Modify: `C:\Users\tpanz\vet-dashboard\index.html:3471-3477` (listener de `btn-trocar-vet`)
- Modify: `C:\Users\tpanz\vet-dashboard\index.html:3479-3488` (`init`/`render` do módulo `pacientes`)

**Interfaces:**
- Consumes: `DuoVet.auth.getSessionVet()` agora retorna `{ uid, nome, email, orgId }` (Task 4) — todo lugar que lia `vet.id` passa a ler `vet.uid`.

- [ ] **Step 1: Remover o markup da `.pac-logged-bar`**

Localizar:
```html
        <div class="pac-logged-bar">
          <span><i class="ti ti-user-check"></i> Logado: <strong id="pac-logged-nome"></strong></span>
          <button type="button" id="btn-trocar-vet" class="link-btn"><i class="ti ti-logout"></i> Trocar veterinário</button>
        </div>
```

Remover esse bloco inteiro (a informação "logado como" e o botão "Sair" já vivem no cabeçalho global, adicionados na Task 5).

- [ ] **Step 2: Remover `renderLoggedBar` e suas chamadas**

Localizar e remover a função inteira:
```js
  // ---- Barra "Logado como" -------------------------------------------------------
  function renderLoggedBar() {
    const vet = DuoVet.auth.getSessionVet();
    const el = document.getElementById("pac-logged-nome");
    if (el) el.textContent = vet ? vet.nome : "—";
  }
```

Localizar as duas chamadas restantes (em `init()` e em `render()`) e remover as linhas `renderLoggedBar();` de dentro de cada uma.

- [ ] **Step 3: Atualizar `visiblePatients()` para usar `vet.uid`**

Localizar:
```js
  function visiblePatients() {
    const vet = DuoVet.auth.getSessionVet();
    const vetId = vet ? vet.id : null;
    return DuoVet.state.getPatients().filter((p) => !p.vetId || p.vetId === vetId);
  }
```

Substituir por:
```js
  function visiblePatients() {
    const vet = DuoVet.auth.getSessionVet();
    const vetId = vet ? vet.uid : null;
    return DuoVet.state.getPatients().filter((p) => !p.vetId || p.vetId === vetId);
  }
```

- [ ] **Step 4: Atualizar `handleSubmitPaciente` para usar `vet.uid`**

Localizar:
```js
    if (editingPatientId) {
      // Editar não reatribui o dono do cadastro — o vínculo com o
      // veterinário que criou o paciente é definido só na criação.
      DuoVet.state.updatePatient(editingPatientId, entry);
    } else {
      const vet = DuoVet.auth.getSessionVet();
      entry.vetId = vet ? vet.id : null;
      DuoVet.state.addPatient(entry);
    }
```

Substituir por:
```js
    if (editingPatientId) {
      // Editar não reatribui o dono do cadastro — o vínculo com o
      // veterinário que criou o paciente é definido só na criação.
      DuoVet.state.updatePatient(editingPatientId, entry);
    } else {
      const vet = DuoVet.auth.getSessionVet();
      entry.vetId = vet ? vet.uid : null;
      DuoVet.state.addPatient(entry);
    }
```

- [ ] **Step 5: Remover o listener de `btn-trocar-vet` (elemento não existe mais)**

Localizar e remover:
```js
    document.getElementById("btn-trocar-vet").addEventListener("click", () => {
      DuoVet.auth.logout();
      DuoVet.auth.openLoginOverlay(
        () => renderLoggedBar(),
        () => document.querySelector('.nav-btn[data-tab="dashboard"]').click()
      );
    });
```

(O botão "Sair" global, adicionado na Task 5, já cobre esse caso — trocar de veterinário agora é simplesmente clicar em "Sair" no cabeçalho e fazer login com outra conta.)

- [ ] **Step 6: Verificar sintaxe do módulo**

Run:
```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('C:/Users/tpanz/vet-dashboard/index.html', 'utf8');
const start = html.indexOf('DuoVet.pacientes = (function () {');
const end = html.indexOf('</script>', start);
const code = html.slice(start, end);
try { new Function(code); console.log('PASS - sintaxe válida'); }
catch (e) { console.log('FAIL -', e.message); process.exit(1); }
"
```
Expected: `PASS - sintaxe válida`

- [ ] **Step 7: Grep de confirmação — nenhuma referência antiga sobrou**

Run:
```bash
grep -n "pac-logged-bar\|pac-logged-nome\|btn-trocar-vet\|vet\.id\b" "/c/Users/tpanz/vet-dashboard/index.html"
```
Expected: nenhuma ocorrência (saída vazia). Se aparecer algo, é uma referência esquecida que precisa ser limpa.

---

### Task 7: Publicar no GitHub e habilitar o GitHub Pages

**Files:** nenhum arquivo de código — só ações de git/GitHub.

**Interfaces:** nenhuma (task de infraestrutura).

- [ ] **Step 1: Commitar todo o código das Tasks 2-6**

Run:
```bash
cd "C:/Users/tpanz/vet-dashboard"
git add index.html
git commit -m "feat: add Firebase multi-org backend (Firestore + Auth) replacing localStorage"
```
Expected: commit criado.

- [ ] **Step 2: Confirmar com o usuário antes de criar o repositório remoto e publicar**

Esta etapa cria um repositório **público** no GitHub e faz `git push` — uma ação visível e com efeito em serviço externo. Antes de rodar os comandos abaixo, confirmar explicitamente com o usuário (nome do repositório, conta do GitHub a usar).

- [ ] **Step 3: Criar o repositório no GitHub e enviar o código**

Run (após confirmação do usuário):
```bash
cd "C:/Users/tpanz/vet-dashboard"
gh repo create vet-dashboard --public --source=. --remote=origin
git push -u origin main
```
Expected: repositório criado em `https://github.com/<usuário>/vet-dashboard`, branch `main` enviada.

- [ ] **Step 4: Habilitar o GitHub Pages**

Run:
```bash
gh api -X POST "repos/{owner}/vet-dashboard/pages" -f "source[branch]=main" -f "source[path]=/"
```
Expected: resposta JSON confirmando a criação do site (`html_url` apontando para `https://<usuário>.github.io/vet-dashboard/`). Se o comando retornar erro `422` (Pages já habilitado ou precisa ser feito pela interface web na primeira vez), habilitar manualmente em **Settings → Pages** do repositório no GitHub, escolhendo a branch `main` e pasta `/ (root)` — e informar isso ao usuário.

---

### Task 8: Configuração manual do Firebase (usuário) + verificação final ponta a ponta

**Files:** nenhum arquivo novo — `index.html` recebe apenas a config real do Firebase (já preparada como placeholder na Task 2).

**Interfaces:** nenhuma nova — esta task valida o comportamento real de todas as anteriores contra um projeto Firebase de verdade.

- [ ] **Step 1: Usuário completa a configuração manual do Firebase**

Seguir os passos 1-8 do `README.md` (criado na Task 1): criar o projeto no Firebase, ativar Firestore + Authentication (Email/senha), publicar `firestore.rules`, criar `organizations/duovet` e sua `allowlist` com pelo menos um email de teste.

- [ ] **Step 2: Colar a configuração real no código**

Modificar o bloco `const firebaseConfig = {...}` adicionado na Task 2, substituindo os valores `"SUBSTITUA_AQUI"` pelos valores reais copiados do Console do Firebase.

- [ ] **Step 3: Verificação ponta a ponta via CDP contra o projeto real**

Run (o e-mail usado no cadastro precisa estar previamente na `allowlist` de `organizations/duovet`, criada no Step 1 — ajustar `TEST_EMAIL` conforme o email real usado):
```bash
cat > "/c/Users/tpanz/AppData/Local/Temp/claude/C--Users-tpanz/79878f48-c867-45f4-b9ba-5acd963d7614/scratchpad/verify-firebase-e2e.mjs" <<'EOF'
import { spawn } from "node:child_process";
import fs from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = "file:///C:/Users/tpanz/vet-dashboard/index.html";
const PROFILE = "C:/Users/tpanz/AppData/Local/Temp/claude-chrome-profile-fb-e2e-v1";
const TEST_EMAIL = "SUBSTITUA_PELO_EMAIL_NA_ALLOWLIST";
const TEST_ORG = "duovet";

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function ok(label, cond) { console.log(`${cond ? "PASS" : "FAIL"} - ${label}`); return cond; }

async function main() {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9463", `--user-data-dir=${PROFILE}`, "--window-size=1200,900", URL], { stdio: "ignore" });
  try {
    for (let i = 0; i < 60; i++) {
      try { const res = await fetch("http://127.0.0.1:9463/json/version"); if (res.ok) break; } catch {}
      await sleep(500);
    }
    const targets = await (await fetch("http://127.0.0.1:9463/json")).json();
    const target = targets.find((t) => t.url.includes("index.html"));
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.addEventListener("open", resolve));
    let msgId = 0;
    const pending = new Map();
    const errors = [];
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
      if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.text);
      if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
    });
    function send(method, params = {}) {
      const id = ++msgId;
      return new Promise((resolve) => { pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
    }
    async function evaluate(expression) {
      const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (res.result?.exceptionDetails) console.log("EVAL ERROR:", res.result.exceptionDetails.text);
      return res.result?.result?.value;
    }
    await send("Page.enable");
    await send("Runtime.enable");
    await sleep(2000);

    // Cadastro real
    await evaluate('document.getElementById("auth-toggle-link").click()');
    await evaluate('document.getElementById("auth-nome").value = "Vet de Teste"');
    await evaluate(`document.getElementById("auth-org").value = ${JSON.stringify(TEST_ORG)}`);
    await evaluate(`document.getElementById("auth-email").value = ${JSON.stringify(TEST_EMAIL)}`);
    await evaluate('document.getElementById("auth-senha").value = "senha123456"');
    await evaluate('document.getElementById("form-auth-login").dispatchEvent(new Event("submit", {cancelable:true}))');
    await sleep(3000);

    ok("Login concluído (overlay fechou)", (await evaluate('document.getElementById("auth-overlay").classList.contains("hidden")')) === true);
    ok("Nome aparece no cabeçalho", (await evaluate('document.getElementById("header-auth-nome").textContent')) === "Vet de Teste");

    await sleep(2000); // tempo para os listeners do Firestore entregarem o primeiro snapshot
    ok("Sincronização concluída (loading sumiu)", (await evaluate('DuoVet.state.isReady()')) === true);
    ok("Categorias padrão foram semeadas", (await evaluate('DuoVet.state.getCategories().length')) >= 4);

    // Cadastrar um paciente de teste e conferir isolamento por vetId
    await evaluate('document.querySelector(\'.nav-btn[data-tab="pacientes"]\').click()');
    await evaluate('document.getElementById("btn-novo-paciente").click()');
    await evaluate('document.getElementById("paciente-nome-pet").value = "PacienteE2E"');
    await evaluate('document.getElementById("paciente-especie").value = "Canina"');
    await evaluate('document.getElementById("paciente-especie").dispatchEvent(new Event("change", {bubbles:true}))');
    await evaluate('document.getElementById("paciente-tutor-nome").value = "Tutor E2E"');
    await evaluate('document.getElementById("form-paciente").dispatchEvent(new Event("submit", {cancelable:true}))');
    await sleep(2000);
    const patient = await evaluate('DuoVet.state.getPatients().find(p => p.nomePet === "PacienteE2E")');
    ok("Paciente salvo no Firestore com vetId preenchido", !!(patient && patient.vetId));

    // Logout
    await evaluate('document.getElementById("btn-logout").click()');
    await sleep(1000);
    ok("Overlay de login volta a aparecer após Sair", (await evaluate('!document.getElementById("auth-overlay").classList.contains("hidden")')) === true);
    ok("Cabeçalho 'logado como' some após Sair", (await evaluate('document.getElementById("header-auth").classList.contains("hidden")')) === true);

    console.log("--- erros de console/exceptions capturados ---");
    console.log(errors.length ? errors : "nenhum");
    ws.close();
  } finally {
    try { chrome.kill(); } catch {}
    await sleep(500);
  }
}
main().catch(console.error);
EOF
node "/c/Users/tpanz/AppData/Local/Temp/claude/C--Users-tpanz/79878f48-c867-45f4-b9ba-5acd963d7614/scratchpad/verify-firebase-e2e.mjs"
```
Expected: todas as linhas `PASS`, sem erros de console (fora os esperados, se algum). Se algo falhar aqui — diferente das tasks anteriores — é quase certo que o problema está nas regras do Firestore ou na configuração manual do Step 1/2, não no código; revisar `firestore.rules` publicada e os documentos `organizations/duovet` / `organizations/duovet/allowlist/{email}`.

- [ ] **Step 4: Commit final (se algo precisar de ajuste após o teste real) e push**

Run (só se houve ajuste de código; a config do Firebase com valores reais **pode** ser commitada, pois não é segreda):
```bash
cd "C:/Users/tpanz/vet-dashboard"
git add index.html
git commit -m "chore: paste real Firebase project config"
git push
```
Expected: push concluído; o site publicado no GitHub Pages (Task 7) reflete a versão com backend real funcionando.

---

## Self-Review

**Cobertura da spec:**
- Migrar persistência para Firestore mantendo API do `state` → Task 3.
- Login real (Firebase Auth) com autocadastro gated por allowlist → Task 4.
- Multi-organização (`organizations/{orgId}/...`, `users/{uid}.orgId`) → Tasks 1 (rules), 3, 4.
- Sincronização em tempo real → Task 3 (`onSnapshot`).
- Login protegendo o app inteiro (não só Pacientes) → Task 5.
- Remoção do Cancelar/ESC do login → Task 4 (markup sem esses botões, sem listener de ESC).
- Estados de carregamento e erro de conexão → Tasks 4 (markup) e 5 (lógica).
- Publicação GitHub + Pages → Task 7.
- Passos manuais do Firebase documentados → Task 1 (`README.md`), executados na Task 8.
- Fora do escopo respeitado: sem migração de dados antigos (Firestore começa vazio, só com seed dos padrões), sem Cloud Functions, sem tela de autocadastro de organização, sem recuperação de senha.

**Placeholders:** nenhum `TBD`/"implementar depois" — todo código e comando estão completos. As únicas strings literais `"SUBSTITUA_AQUI"` são propositais (placeholders da config do Firebase que o próprio usuário preenche na Task 8, documentado explicitamente).

**Consistência de tipos:** `getSessionVet()` retorna `{ uid, nome, email, orgId }` de forma consistente entre a Task 4 (produz) e a Task 6 (`vet.uid`, consome). `DuoVet.state.startSync(orgId)`/`stopSync()` têm a mesma assinatura entre Task 3 (produz) e Task 4 (consome, dentro de `onAuthStateChanged`). Evento `"duovet:authchanged"` é disparado pela Task 4 e consumido pela Task 5.
