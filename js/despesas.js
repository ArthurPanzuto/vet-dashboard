// despesas.js — aba "Gastos": cadastro de despesas fixas e variáveis (aluguel,
// internet, fornecedores, equipamentos...) que alimentam o "Gastos" do
// gráfico "Gastos vs. Ganhos" do Painel Principal, somadas ao custo das
// vendas já registrado em cada transação.
window.DuoVet = window.DuoVet || {};

DuoVet.despesas = (function () {
  const { formatCurrency, formatDate, monthKey } = DuoVet.utils;

  const TIPO_LABELS = { fixa: "Despesa Fixa", variavel: "Despesa Variável" };
  const TIPO_ICONS = { fixa: "ti-repeat", variavel: "ti-adjustments" };

  function renderStats() {
    const elFixas = document.getElementById("gasto-stat-fixas");
    const elVariaveis = document.getElementById("gasto-stat-variaveis");
    const elTotal = document.getElementById("gasto-stat-total");
    if (!elFixas || !elVariaveis || !elTotal) return;

    const thisMonth = monthKey(new Date());
    const doMes = DuoVet.state.getDespesas().filter((d) => monthKey(d.data) === thisMonth);
    const fixas = doMes.filter((d) => d.tipo === "fixa").reduce((sum, d) => sum + d.valor, 0);
    const variaveis = doMes.filter((d) => d.tipo === "variavel").reduce((sum, d) => sum + d.valor, 0);

    elFixas.textContent = formatCurrency(fixas);
    elVariaveis.textContent = formatCurrency(variaveis);
    elTotal.textContent = formatCurrency(fixas + variaveis);
  }

  function renderTable() {
    const tbody = document.getElementById("despesas-tbody");
    if (!tbody) return;
    const despesas = DuoVet.state.getDespesas().slice().sort((a, b) => b.data - a.data);

    if (despesas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty"><i class="ti ti-report-money"></i><p>Nenhum gasto cadastrado ainda.</p></td></tr>';
      return;
    }

    tbody.innerHTML = despesas
      .map(
        (d) => `
        <tr data-id="${d.id}">
          <td>${formatDate(d.data)}</td>
          <td>${d.descricao}</td>
          <td>${d.categoria || "—"}</td>
          <td>
            <span class="badge" style="${d.tipo === "fixa" ? "background:var(--blue-l);color:var(--blue)" : "background:var(--amber-l);color:var(--amber)"}"><i class="ti ${TIPO_ICONS[d.tipo]}"></i> ${TIPO_LABELS[d.tipo]}</span>
          </td>
          <td>${formatCurrency(d.valor)}</td>
          <td class="text-right">
            <button type="button" class="link-btn link-danger btn-remover-despesa" data-id="${d.id}">Remover</button>
          </td>
        </tr>`
      )
      .join("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    const entry = {
      descricao: document.getElementById("despesa-descricao").value.trim(),
      valor: parseFloat(document.getElementById("despesa-valor").value),
      data: new Date(document.getElementById("despesa-data").value + "T00:00:00"),
      categoria: document.getElementById("despesa-categoria").value.trim(),
      tipo: document.getElementById("despesa-tipo").value,
    };
    if (!entry.descricao || !entry.tipo || Number.isNaN(entry.valor) || Number.isNaN(entry.data.getTime())) return;

    DuoVet.state.addDespesa(entry);
    event.target.reset();
    setDefaultDate();
  }

  function handleTableClick(event) {
    const btn = event.target.closest(".btn-remover-despesa");
    if (!btn) return;
    if (confirm("Remover este gasto? Isso também atualiza o gráfico Gastos vs. Ganhos.")) {
      DuoVet.state.removeDespesa(btn.dataset.id);
    }
  }

  function setDefaultDate() {
    const input = document.getElementById("despesa-data");
    if (input && !input.value) {
      const today = new Date();
      input.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    }
  }

  function init() {
    const form = document.getElementById("form-despesa");
    const tbody = document.getElementById("despesas-tbody");
    if (!form || !tbody) return;

    form.addEventListener("submit", handleSubmit);
    tbody.addEventListener("click", handleTableClick);

    setDefaultDate();
    renderTable();
    renderStats();
  }

  function render() {
    renderTable();
    renderStats();
  }

  return { init, render };
})();
