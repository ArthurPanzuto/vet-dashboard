// state.js — "banco de dados" simulado da DuoVet.
//
// Não existe backend/API aqui: os dados vivem no localStorage do navegador
// (chave STORAGE_KEY, como JSON). Isso é o suficiente para uma clínica usar o
// painel no dia a dia num computador/navegador fixo — os dados sobrevivem a
// fechar a aba, fechar o navegador e reiniciar o PC. O que NÃO persiste: dados
// não sincronizam entre dispositivos/navegadores diferentes, e limpar o
// histórico/cache do navegador apaga tudo. Trocar por uma API real no futuro
// exigiria só reescrever `load`/`persist` deste arquivo, mantendo a mesma
// "interface" (getTransactions, addTransaction, subscribe, etc.), sem tocar
// nas telas.
//
// Categorias e tipos de evento vêm com uma configuração inicial
// (Consulta/Cirurgia/... e Cirurgia/Retorno/Tarefa) só para servir de ponto de
// partida na primeiríssima vez que o painel é aberto — ambas as listas são
// totalmente editáveis nas telas de Serviços e Calendário, e a partir daí o
// que estiver salvo no navegador manda.
//
// Padrão pub/sub: qualquer tela que exiba dados chama `subscribe(callback)` uma
// vez. Sempre que algo muda (uma venda é registrada, um serviço é editado...),
// `notify()` roda: persiste tudo no localStorage e chama os callbacks
// inscritos — é assim que o Dashboard "reage em tempo real" a uma nova venda
// sem precisar recarregar nada.
window.DuoVet = window.DuoVet || {};

DuoVet.state = (function () {
  const { generateId, nextPaletteVar } = DuoVet.utils;
  const STORAGE_KEY = "duovet-data-v1";

  // ---- Estado inicial (usado só se não houver nada salvo ainda) ------------
  let categories = [
    { id: generateId(), nome: "Consulta", colorVar: nextPaletteVar(0), valorPadrao: 0, custoPadrao: 0 },
    { id: generateId(), nome: "Aplicação de Vacina/Medicação", colorVar: nextPaletteVar(1), valorPadrao: 0, custoPadrao: 0 },
    { id: generateId(), nome: "Cirurgia", colorVar: nextPaletteVar(2), valorPadrao: 0, custoPadrao: 0 },
    { id: generateId(), nome: "Venda de Remédio", colorVar: nextPaletteVar(3), valorPadrao: 0, custoPadrao: 0 },
  ];
  let eventTypes = [
    { id: generateId(), nome: "Cirurgia", colorVar: "--red" },
    { id: generateId(), nome: "Retorno", colorVar: "--blue" },
    { id: generateId(), nome: "Tarefa Importante", colorVar: "--amber" },
  ];
  let transactions = [];
  let appointments = [];
  let despesas = [];
  let patients = [];

  // ---- Persistência (localStorage) -------------------------------------------
  function load() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return; // navegador bloqueou localStorage (ex: modo privado) — segue com o padrão em memória.
    }
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);
      // Datas viram string no JSON — precisam voltar a ser Date ao carregar.
      if (Array.isArray(saved.categories)) categories = saved.categories;
      if (Array.isArray(saved.eventTypes)) eventTypes = saved.eventTypes;
      if (Array.isArray(saved.transactions)) {
        transactions = saved.transactions.map((t) => ({ ...t, data: new Date(t.data) }));
      }
      if (Array.isArray(saved.appointments)) {
        appointments = saved.appointments.map((a) => ({ ...a, data: new Date(a.data) }));
      }
      if (Array.isArray(saved.despesas)) {
        despesas = saved.despesas.map((d) => ({ ...d, data: new Date(d.data) }));
      }
      if (Array.isArray(saved.patients)) {
        patients = saved.patients.map((p) => ({
          ...p,
          consultas: (p.consultas || []).map((c) => ({ ...c, data: new Date(c.data) })),
          vacinas: (p.vacinas || []).map((v) => ({
            ...v,
            data: new Date(v.data),
            proximaDose: v.proximaDose ? new Date(v.proximaDose) : null,
          })),
        }));
      }
    } catch (e) {
      console.error("DuoVet: dados salvos corrompidos, ignorando e começando do padrão.", e);
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ categories, eventTypes, transactions, appointments, despesas, patients }));
    } catch (e) {
      console.error("DuoVet: não foi possível salvar os dados (localStorage indisponível ou cheio).", e);
    }
  }

  load();

  // ---- Pub/Sub ---------------------------------------------------------------
  let listeners = [];

  function subscribe(callback) {
    listeners.push(callback);
    return function unsubscribe() {
      listeners = listeners.filter((l) => l !== callback);
    };
  }

  function notify() {
    persist();
    listeners.forEach((callback) => callback());
  }

  // ---- API: categorias --------------------------------------------------------
  function getCategories() {
    return categories.slice();
  }

  function addCategory(entry) {
    categories.push({ id: generateId(), colorVar: nextPaletteVar(categories.length), ...entry });
    notify();
  }

  function updateCategory(id, entry) {
    categories = categories.map((c) => (c.id === id ? { ...c, ...entry } : c));
    notify();
  }

  function removeCategory(id) {
    categories = categories.filter((c) => c.id !== id);
    notify();
  }

  // ---- API: tipos de evento ----------------------------------------------------
  function getEventTypes() {
    return eventTypes.slice();
  }

  function addEventType(nome) {
    eventTypes.push({ id: generateId(), nome, colorVar: nextPaletteVar(eventTypes.length) });
    notify();
  }

  function removeEventType(id) {
    eventTypes = eventTypes.filter((t) => t.id !== id);
    notify();
  }

  // ---- API: transações ---------------------------------------------------
  function getTransactions() {
    return transactions.slice();
  }

  function addTransaction(entry) {
    transactions.push({
      id: generateId(),
      lucro: entry.valorBruto - entry.custo,
      ...entry,
    });
    notify();
  }

  function removeTransaction(id) {
    transactions = transactions.filter((t) => t.id !== id);
    notify();
  }

  // ---- API: agenda -----------------------------------------------------------
  function getAppointments() {
    return appointments.slice();
  }

  function addAppointment(entry) {
    appointments.push({ id: generateId(), ...entry });
    notify();
  }

  function removeAppointment(id) {
    appointments = appointments.filter((a) => a.id !== id);
    notify();
  }

  // ---- API: despesas ---------------------------------------------------------
  function getDespesas() {
    return despesas.slice();
  }

  function addDespesa(entry) {
    despesas.push({ id: generateId(), ...entry });
    notify();
  }

  function removeDespesa(id) {
    despesas = despesas.filter((d) => d.id !== id);
    notify();
  }

  // ---- API: pacientes ---------------------------------------------------------
  function getPatients() {
    return patients.slice();
  }

  function addPatient(entry) {
    patients.push({ id: generateId(), consultas: [], vacinas: [], ...entry });
    notify();
  }

  function updatePatient(id, entry) {
    patients = patients.map((p) => (p.id === id ? { ...p, ...entry } : p));
    notify();
  }

  function removePatient(id) {
    patients = patients.filter((p) => p.id !== id);
    notify();
  }

  function addConsulta(patientId, entry) {
    patients = patients.map((p) =>
      p.id === patientId ? { ...p, consultas: [...p.consultas, { id: generateId(), ...entry }] } : p
    );
    notify();
  }

  function removeConsulta(patientId, consultaId) {
    patients = patients.map((p) =>
      p.id === patientId ? { ...p, consultas: p.consultas.filter((c) => c.id !== consultaId) } : p
    );
    notify();
  }

  function addVacina(patientId, entry) {
    patients = patients.map((p) =>
      p.id === patientId ? { ...p, vacinas: [...p.vacinas, { id: generateId(), ...entry }] } : p
    );
    notify();
  }

  function removeVacina(patientId, vacinaId) {
    patients = patients.map((p) =>
      p.id === patientId ? { ...p, vacinas: p.vacinas.filter((v) => v.id !== vacinaId) } : p
    );
    notify();
  }

  return {
    subscribe,
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
    addConsulta,
    removeConsulta,
    addVacina,
    removeVacina,
  };
})();
