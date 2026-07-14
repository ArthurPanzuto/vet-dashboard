// charts.js — os gráficos do Painel Principal, usando Chart.js (via CDN).
// Instâncias ficam em variáveis de módulo para que possamos apenas atualizar os
// dados (`chart.update()`) quando o estado muda, em vez de recriar o canvas.
// No modo escuro as cores não são um mero filtro CSS: usamos tons próprios
// validados para leitura em cada superfície (ver skill de dataviz), então os
// gráficos são recriados quando o tema muda (`refreshTheme`).
window.DuoVet = window.DuoVet || {};

DuoVet.charts = (function () {
  const { WEEKDAY_LABELS, MONTH_LABELS_SHORT, FALLBACK_COLOR_VAR, formatCurrency, formatPercent,
    addDays, addMonths, dateKey, monthKey } = DuoVet.utils;

  // Hex validado por token de cor (ver css/styles.css e a skill de dataviz) —
  // canvas não lê custom properties, então precisamos do valor fixo aqui.
  // A mesma tabela serve tanto para categorias de serviço quanto para tipos
  // de evento, já que ambos usam os tokens de DuoVet.utils.PALETTE_VARS.
  const VAR_HEX = {
    "--blue": { light: "#1d6fd1", dark: "#3987e5" },
    "--green": { light: "#15803d", dark: "#16a34a" },
    "--violet": { light: "#7c3aed", dark: "#9085e9" },
    "--amber": { light: "#b45309", dark: "#c98500" },
    "--red": { light: "#c22b2b", dark: "#e66767" },
    [FALLBACK_COLOR_VAR]: { light: "#8a93a3", dark: "#9aa1ac" },
  };
  const SEQUENTIAL_BLUE = { light: "#1d6fd1", dark: "#3987e5" };
  const GANHOS_COLOR = VAR_HEX["--green"];
  const GASTOS_COLOR = VAR_HEX["--red"];
  const AXIS_MUTED = "#8a93a3";
  const GRIDLINE = { light: "#e5e7eb", dark: "#262b36" };
  const CHART_SURFACE = { light: "#ffffff", dark: "#14161d" };
  const LEGEND_INK = { light: "#4b5563", dark: "#9aa1ac" };

  let weeklyChart = null;
  let categoryChart = null;
  let monthlyRevenueChart = null;
  let marginChart = null;
  let expensesChart = null;

  function isDark() {
    return document.documentElement.getAttribute("data-theme") !== "light";
  }
  function mode() {
    return isDark() ? "dark" : "light";
  }

  function lastNMonths(n) {
    const months = [];
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    for (let i = n - 1; i >= 0; i--) months.push(addMonths(start, -i));
    return months;
  }

  function buildWeeklySeries(transactions) {
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(addDays(new Date(), -i));
    const totalsByKey = {};
    transactions.forEach((t) => {
      const key = dateKey(t.data);
      totalsByKey[key] = (totalsByKey[key] || 0) + t.valorBruto;
    });
    return {
      labels: days.map((d) => WEEKDAY_LABELS[d.getDay()]),
      values: days.map((d) => totalsByKey[dateKey(d)] || 0),
    };
  }

  function buildCategorySeries(transactions) {
    const m = mode();
    const categories = DuoVet.state.getCategories();
    const totalsByName = {};
    transactions.forEach((t) => { totalsByName[t.categoria] = (totalsByName[t.categoria] || 0) + t.valorBruto; });

    // Segue a ordem/cor fixa de state.getCategories() (atribuída na criação),
    // e agrupa transações de categorias já apagadas em "Outros" (cor neutra).
    const known = new Set();
    const entries = categories
      .map((cat) => {
        known.add(cat.nome);
        return { label: cat.nome, total: totalsByName[cat.nome] || 0, colorVar: cat.colorVar };
      })
      .filter((e) => e.total > 0);

    const outros = Object.entries(totalsByName)
      .filter(([nome]) => !known.has(nome))
      .reduce((sum, [, v]) => sum + v, 0);
    if (outros > 0) entries.push({ label: "Outros", total: outros, colorVar: FALLBACK_COLOR_VAR });

    return {
      labels: entries.map((e) => e.label),
      values: entries.map((e) => e.total),
      colors: entries.map((e) => VAR_HEX[e.colorVar][m]),
    };
  }

  function buildMonthlyTotals(transactions, months) {
    const totalsByMonth = {};
    transactions.forEach((t) => {
      const key = monthKey(t.data);
      if (!totalsByMonth[key]) totalsByMonth[key] = { receita: 0, custo: 0 };
      totalsByMonth[key].receita += t.valorBruto;
      totalsByMonth[key].custo += t.custo;
    });
    return months.map((m) => totalsByMonth[monthKey(m)] || { receita: 0, custo: 0 });
  }

  // Soma dos gastos cadastrados na aba "Gastos" (aluguel, fornecedores...) por
  // mês — somado ao custo das vendas para formar o total de "Gastos" do
  // gráfico Gastos vs. Ganhos.
  function buildDespesasByMonth(despesas, months) {
    const totalsByMonth = {};
    despesas.forEach((d) => {
      const key = monthKey(d.data);
      totalsByMonth[key] = (totalsByMonth[key] || 0) + d.valor;
    });
    return months.map((m) => totalsByMonth[monthKey(m)] || 0);
  }

  function renderWeeklyChart(transactions) {
    const ctx = document.getElementById("chart-weekly");
    if (!ctx) return;
    const { labels, values } = buildWeeklySeries(transactions);
    if (weeklyChart) {
      weeklyChart.data.labels = labels;
      weeklyChart.data.datasets[0].data = values;
      weeklyChart.update();
      return;
    }
    const m = mode();
    weeklyChart = new Chart(ctx, {
      type: "bar",
      data: { labels, datasets: [{ label: "Faturamento", data: values, backgroundColor: SEQUENTIAL_BLUE[m], borderRadius: 4, maxBarThickness: 40 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (i) => formatCurrency(i.parsed.y) } } },
        scales: {
          y: { beginAtZero: true, ticks: { color: AXIS_MUTED, callback: (v) => formatCurrency(v) }, grid: { color: GRIDLINE[m] } },
          x: { ticks: { color: AXIS_MUTED }, grid: { display: false } },
        },
      },
    });
  }

  function renderCategoryChart(transactions) {
    const ctx = document.getElementById("chart-category");
    if (!ctx) return;
    const { labels, values, colors } = buildCategorySeries(transactions);
    if (categoryChart) {
      categoryChart.data.labels = labels;
      categoryChart.data.datasets[0].data = values;
      categoryChart.data.datasets[0].backgroundColor = colors;
      categoryChart.update();
      return;
    }
    const m = mode();
    categoryChart = new Chart(ctx, {
      type: "doughnut",
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: CHART_SURFACE[m], borderWidth: 2, hoverOffset: 6 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: { position: "bottom", labels: { color: LEGEND_INK[m], boxWidth: 12, padding: 16 } },
          tooltip: { callbacks: { label: (i) => `${i.label}: ${formatCurrency(i.parsed)}` } },
        },
      },
    });
  }

  function renderMonthlyRevenueChart(transactions) {
    const ctx = document.getElementById("chart-monthly-revenue");
    if (!ctx) return;
    const months = lastNMonths(6);
    const totals = buildMonthlyTotals(transactions, months);
    const labels = months.map((d) => MONTH_LABELS_SHORT[d.getMonth()]);
    const values = totals.map((t) => t.receita);

    if (monthlyRevenueChart) {
      monthlyRevenueChart.data.labels = labels;
      monthlyRevenueChart.data.datasets[0].data = values;
      monthlyRevenueChart.update();
      return;
    }
    const m = mode();
    monthlyRevenueChart = new Chart(ctx, {
      type: "bar",
      data: { labels, datasets: [{ label: "Faturamento", data: values, backgroundColor: SEQUENTIAL_BLUE[m], borderRadius: 4, maxBarThickness: 44 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (i) => formatCurrency(i.parsed.y) } } },
        scales: {
          y: { beginAtZero: true, ticks: { color: AXIS_MUTED, callback: (v) => formatCurrency(v) }, grid: { color: GRIDLINE[m] } },
          x: { ticks: { color: AXIS_MUTED }, grid: { display: false } },
        },
      },
    });
  }

  function renderMarginChart(transactions) {
    const ctx = document.getElementById("chart-margin");
    if (!ctx) return;
    const months = lastNMonths(6);
    const totals = buildMonthlyTotals(transactions, months);
    const labels = months.map((d) => MONTH_LABELS_SHORT[d.getMonth()]);
    const values = totals.map((t) => (t.receita > 0 ? ((t.receita - t.custo) / t.receita) * 100 : 0));

    if (marginChart) {
      marginChart.data.labels = labels;
      marginChart.data.datasets[0].data = values;
      marginChart.update();
      return;
    }
    const m = mode();
    marginChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Margem de lucro", data: values, borderColor: SEQUENTIAL_BLUE[m], backgroundColor: SEQUENTIAL_BLUE[m],
          borderWidth: 2, tension: .3, pointRadius: 4, pointBackgroundColor: SEQUENTIAL_BLUE[m], fill: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (i) => formatPercent(i.parsed.y) } } },
        scales: {
          y: { ticks: { color: AXIS_MUTED, callback: (v) => `${v}%` }, grid: { color: GRIDLINE[m] } },
          x: { ticks: { color: AXIS_MUTED }, grid: { display: false } },
        },
      },
    });
  }

  function renderExpensesChart(transactions) {
    const ctx = document.getElementById("chart-expenses");
    if (!ctx) return;
    const months = lastNMonths(6);
    const totals = buildMonthlyTotals(transactions, months);
    const despesasPorMes = buildDespesasByMonth(DuoVet.state.getDespesas(), months);
    const labels = months.map((d) => MONTH_LABELS_SHORT[d.getMonth()]);
    const ganhos = totals.map((t) => t.receita);
    // Gastos = custo das vendas (COGS) + despesas fixas/variáveis cadastradas.
    const gastos = totals.map((t, i) => t.custo + despesasPorMes[i]);

    if (expensesChart) {
      expensesChart.data.labels = labels;
      expensesChart.data.datasets[0].data = ganhos;
      expensesChart.data.datasets[1].data = gastos;
      expensesChart.update();
      return;
    }
    const m = mode();
    expensesChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Ganhos", data: ganhos, backgroundColor: GANHOS_COLOR[m], borderRadius: 4, maxBarThickness: 20 },
          { label: "Gastos", data: gastos, backgroundColor: GASTOS_COLOR[m], borderRadius: 4, maxBarThickness: 20 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        // 2 séries com significado universal (verde=entrada, vermelho=saída):
        // legenda sempre visível + tooltip com valor exato, para não depender só da cor.
        plugins: {
          legend: { position: "bottom", labels: { color: LEGEND_INK[m], boxWidth: 12, padding: 16 } },
          tooltip: { callbacks: { label: (i) => `${i.dataset.label}: ${formatCurrency(i.parsed.y)}` } },
        },
        scales: {
          y: { beginAtZero: true, ticks: { color: AXIS_MUTED, callback: (v) => formatCurrency(v) }, grid: { color: GRIDLINE[m] } },
          x: { ticks: { color: AXIS_MUTED }, grid: { display: false } },
        },
      },
    });
  }

  function render(transactions) {
    renderWeeklyChart(transactions);
    renderCategoryChart(transactions);
    renderMonthlyRevenueChart(transactions);
    renderMarginChart(transactions);
    renderExpensesChart(transactions);
  }

  // Chamado quando o usuário alterna claro/escuro: recria todos os gráficos
  // para aplicar o conjunto de cores validado para a nova superfície.
  function refreshTheme() {
    [weeklyChart, categoryChart, monthlyRevenueChart, marginChart, expensesChart].forEach((c) => c && c.destroy());
    weeklyChart = categoryChart = monthlyRevenueChart = marginChart = expensesChart = null;
    render(DuoVet.state.getTransactions());
  }

  return { render, refreshTheme };
})();
