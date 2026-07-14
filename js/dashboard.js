/* DEAD CODE — não utilizado. A implementação real está inline em index.html. Mantido só como histórico. */
// dashboard.js — cards de resumo, hero financeiro, ranking, atividade recente
// e alertas da aba "Painel Principal". Lê sempre do state (nunca guarda sua
// própria cópia dos dados) e delega os gráficos para charts.js.
window.DuoVet = window.DuoVet || {};

DuoVet.dashboard = (function () {
  const {
    formatCurrency, formatDate, formatPercent, isSameMonth, addMonths, addDays,
    startOfDay, FALLBACK_COLOR_VAR,
  } = DuoVet.utils;

  // Busca a cor atribuída a uma categoria/tipo de evento pelo nome. Se o
  // registro original foi apagado (categoria/tipo removido depois que a
  // venda/evento foi criado), cai numa cor neutra em vez de quebrar.
  function colorVarFor(nome, list) {
    const found = list.find((item) => item.nome === nome);
    return found ? found.colorVar : FALLBACK_COLOR_VAR;
  }

  function totalsFor(transactions, monthDate) {
    const doMes = transactions.filter((t) => isSameMonth(t.data, monthDate));
    const faturamento = doMes.reduce((sum, t) => sum + t.valorBruto, 0);
    const lucro = doMes.reduce((sum, t) => sum + t.lucro, 0);
    const atendimentos = doMes.length;
    const ticketMedio = atendimentos > 0 ? faturamento / atendimentos : 0;
    const margem = faturamento > 0 ? (lucro / faturamento) * 100 : 0;
    return { faturamento, lucro, atendimentos, ticketMedio, margem };
  }

  function trendPct(current, previous) {
    if (previous <= 0) return null;
    return ((current - previous) / previous) * 100;
  }

  function renderTrendBadge(elId, current, previous) {
    const el = document.getElementById(elId);
    const pct = trendPct(current, previous);
    if (pct === null) { el.style.display = "none"; return; }
    const up = pct >= 0;
    el.style.display = "inline-flex";
    el.className = `trend ${up ? "up" : "dn"}`;
    el.innerHTML = `<i class="ti ti-arrow-${up ? "up" : "down"}-right" style="font-size:11px"></i> ${Math.abs(pct).toFixed(1)}%`;
  }

  function renderSummary(transactions) {
    const now = new Date();
    const lastMonth = addMonths(now, -1);
    const current = totalsFor(transactions, now);
    const previous = totalsFor(transactions, lastMonth);

    document.getElementById("card-faturamento").textContent = formatCurrency(current.faturamento);
    document.getElementById("card-faturamento-sub").textContent = `${current.atendimentos} atendimento${current.atendimentos !== 1 ? "s" : ""} este mês`;
    renderTrendBadge("trend-faturamento", current.faturamento, previous.faturamento);

    document.getElementById("card-lucro").textContent = formatCurrency(current.lucro);
    document.getElementById("card-lucro-sub").textContent = `Margem: ${formatPercent(current.margem)}`;
    renderTrendBadge("trend-lucro", current.lucro, previous.lucro);

    document.getElementById("card-atendimentos").textContent = String(current.atendimentos);
    document.getElementById("card-atendimentos-sub").textContent = "Consultas, cirurgias e vendas";
    renderTrendBadge("trend-atendimentos", current.atendimentos, previous.atendimentos);

    document.getElementById("card-ticket").textContent = formatCurrency(current.ticketMedio);
    renderTrendBadge("trend-ticket", current.ticketMedio, previous.ticketMedio);

    return { current, previous };
  }

  function renderHero(current, previous) {
    document.getElementById("hero-margem").textContent = formatPercent(current.margem);
    const pct = trendPct(current.margem, previous.margem);
    const sub = document.getElementById("hero-sub");
    if (pct === null) {
      sub.textContent = `Lucro do mês: ${formatCurrency(current.lucro)}`;
    } else {
      const arrow = pct >= 0 ? "melhorou" : "caiu";
      sub.textContent = `Lucro do mês: ${formatCurrency(current.lucro)} · margem ${arrow} ${Math.abs(pct).toFixed(1)}% vs. mês anterior`;
    }
  }

  function marginClass(margem) {
    if (margem >= 50) return "mar-ok";
    if (margem >= 25) return "mar-low";
    return "mar-neg";
  }

  function renderRanking(transactions) {
    const tbody = document.getElementById("tb-ranking");
    if (!tbody) return;
    const now = new Date();
    const doMes = transactions.filter((t) => isSameMonth(t.data, now));

    const porCategoria = {};
    doMes.forEach((t) => {
      if (!porCategoria[t.categoria]) porCategoria[t.categoria] = { nome: t.categoria, qtd: 0, receita: 0, lucro: 0 };
      porCategoria[t.categoria].qtd += 1;
      porCategoria[t.categoria].receita += t.valorBruto;
      porCategoria[t.categoria].lucro += t.lucro;
    });

    const ranking = Object.values(porCategoria)
      .sort((a, b) => b.receita - a.receita)
      .slice(0, 6);

    if (ranking.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty"><i class="ti ti-chart-bar"></i><p>Sem atendimentos este mês ainda.</p></td></tr>';
      return;
    }

    tbody.innerHTML = ranking
      .map((r) => {
        const margem = r.receita > 0 ? (r.lucro / r.receita) * 100 : 0;
        return `
          <tr>
            <td>${r.nome}</td>
            <td>${r.qtd}</td>
            <td>${formatCurrency(r.receita)}</td>
            <td class="${marginClass(margem)}">${formatPercent(margem)}</td>
          </tr>`;
      })
      .join("");
  }

  function renderActivity(transactions) {
    const container = document.getElementById("activity-list");
    if (!container) return;
    const recent = transactions
      .slice()
      .sort((a, b) => b.data - a.data)
      .slice(0, 8);

    if (recent.length === 0) {
      container.innerHTML = '<div class="empty"><i class="ti ti-stethoscope"></i><p>Nenhum atendimento registrado ainda.</p></div>';
      return;
    }

    const categories = DuoVet.state.getCategories();
    container.innerHTML = recent
      .map((t) => {
        const cliente = t.cliente || "Cliente não informado";
        const pet = t.pet ? ` · ${t.pet}` : "";
        const colorVar = colorVarFor(t.categoria, categories);
        return `
          <div class="act-item">
            <span class="act-dot" style="background:var(${colorVar})"></span>
            <div class="act-info">
              <p class="act-title">${t.categoria}</p>
              <p class="act-meta">${cliente}${pet} · ${formatDate(t.data)}</p>
            </div>
            <div class="act-val">
              <div class="act-lucro" style="color:${t.lucro >= 0 ? "var(--green)" : "var(--red)"}">${formatCurrency(t.lucro)}</div>
              <div class="act-preco">${formatCurrency(t.valorBruto)}</div>
            </div>
          </div>`;
      })
      .join("");
  }

  function renderAlerts(appointments) {
    const container = document.getElementById("alerts-list");
    if (!container) return;

    const today = startOfDay(new Date());
    const limite = addDays(today, 7);

    const proximos = appointments
      .filter((a) => a.data >= today && a.data <= limite)
      .sort((a, b) => a.data - b.data);

    if (proximos.length === 0) {
      container.innerHTML = '<div class="empty"><i class="ti ti-calendar-event"></i><p>Nenhum evento agendado para os próximos 7 dias.</p></div>';
      return;
    }

    const eventTypes = DuoVet.state.getEventTypes();
    container.innerHTML = proximos
      .map((a) => {
        const isToday = startOfDay(a.data).getTime() === today.getTime();
        const varName = colorVarFor(a.tipoEvento, eventTypes);
        const quem = [a.cliente, a.pet].filter(Boolean).join(" · ");
        return `
          <div class="alert-item">
            <span class="alert-icon" style="background:color-mix(in srgb, var(${varName}) 16%, transparent); color:var(${varName})">
              <i class="ti ti-calendar-event"></i>
            </span>
            <div class="alert-info">
              <p class="alert-title">${a.tipoEvento}: ${a.titulo}</p>
              <p class="alert-meta">${quem ? quem + " · " : ""}${isToday ? "Hoje" : formatDate(a.data)} às ${a.horario}</p>
            </div>
          </div>`;
      })
      .join("");
  }

  function renderLowMarginAlert(transactions) {
    const banner = document.getElementById("low-margin-alert");
    const text = document.getElementById("low-margin-alert-text");
    if (!banner) return;
    const now = new Date();
    const doMes = transactions.filter((t) => isSameMonth(t.data, now));
    const riscos = doMes.filter((t) => t.valorBruto > 0 && (t.lucro / t.valorBruto) * 100 < 15);
    if (riscos.length === 0) {
      banner.style.display = "none";
      return;
    }
    banner.style.display = "flex";
    text.textContent = `${riscos.length} atendimento${riscos.length !== 1 ? "s" : ""} este mês com margem abaixo de 15% — revise custos ou valores cobrados.`;
  }

  function render() {
    const transactions = DuoVet.state.getTransactions();
    const appointments = DuoVet.state.getAppointments();

    const { current, previous } = renderSummary(transactions);
    renderHero(current, previous);
    renderRanking(transactions);
    renderActivity(transactions);
    renderAlerts(appointments);
    renderLowMarginAlert(transactions);
    DuoVet.charts.render(transactions);
  }

  return { render };
})();
