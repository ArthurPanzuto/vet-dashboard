/* DEAD CODE — não utilizado. A implementação real está inline em index.html. Mantido só como histórico. */
// main.js — ponto de entrada: liga a navegação entre abas e inicializa os
// módulos. Também centraliza a inscrição no state: qualquer mudança nos dados
// (nova venda, serviço editado, evento agendado) recalcula todas as telas
// que dependem daquele dado, simulando atualização "em tempo real".
window.DuoVet = window.DuoVet || {};

(function () {
  const TABS = ["dashboard", "venda", "servicos", "gastos", "historico", "calendario", "pacientes"];
  const TAB_TITLES = {
    dashboard: "Painel",
    venda: "Nova Venda",
    servicos: "Serviços",
    gastos: "Gastos",
    historico: "Histórico",
    calendario: "Calendário",
    pacientes: "Pacientes",
  };

  function switchTab(target) {
    document.getElementById("page-title").textContent = TAB_TITLES[target];
    TABS.forEach((tab) => {
      document.getElementById(`tab-${tab}`).classList.toggle("active", tab === target);
      document.querySelectorAll(`.nav-btn[data-tab="${tab}"]`).forEach((btn) => btn.classList.toggle("active", tab === target));
    });
  }

  function initNav() {
    document.querySelectorAll(".nav-btn[data-tab]").forEach((button) => {
      button.addEventListener("click", () => switchTab(button.dataset.tab));
    });
    // Atalhos dentro do conteúdo (ex: botão do card hero) que levam a outra aba.
    document.querySelectorAll("[data-tab-link]").forEach((el) => {
      el.addEventListener("click", () => switchTab(el.dataset.tabLink));
    });
  }

  function renderAll() {
    DuoVet.dashboard.render();
    DuoVet.servicesView.render();
    DuoVet.form.refreshServiceOptions();
    DuoVet.despesas.render();
    DuoVet.historico.render();
    DuoVet.calendar.render();
    DuoVet.pacientes.render();
    DuoVet.relatorio.render();
  }

  function renderHeaderDate() {
    const el = document.getElementById("header-date");
    if (el) el.textContent = DuoVet.utils.formatDateLong(new Date());
  }

  // O tema em si (atributo data-theme na <html>) já é aplicado por um script
  // inline no <head>, antes do primeiro paint, para evitar flash. Aqui só
  // sincronizamos o ícone do botão e ligamos o clique de alternância.
  function isLightTheme() {
    return document.documentElement.getAttribute("data-theme") === "light";
  }

  function applyThemeIcon() {
    const icon = document.getElementById("theme-icon");
    icon.className = isLightTheme() ? "ti ti-sun" : "ti ti-moon";
  }

  function toggleTheme() {
    const goingLight = !isLightTheme();
    if (goingLight) document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("duovet-theme", goingLight ? "light" : "dark");
    applyThemeIcon();
    DuoVet.charts.refreshTheme();
  }

  function initTheme() {
    applyThemeIcon();
    document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
  }

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
    DuoVet.relatorio.init();

    // Única inscrição central no pub/sub do state — evita cada módulo se
    // inscrever individualmente e todos ficam sincronizados entre si.
    DuoVet.state.subscribe(renderAll);

    DuoVet.dashboard.render();
    switchTab("dashboard");
  });
})();
