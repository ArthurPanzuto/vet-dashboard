/* DEAD CODE — não utilizado. A implementação real está inline em index.html. Mantido só como histórico. */
// historico.js — aba "Histórico": lista todas as vendas/atendimentos já
// registrados, com a opção de remover um lançamento específico.
window.DuoVet = window.DuoVet || {};

DuoVet.historico = (function () {
  const { formatCurrency, formatDate } = DuoVet.utils;

  function render() {
    const tbody = document.getElementById("historico-tbody");
    if (!tbody) return;
    const transactions = DuoVet.state.getTransactions().slice().sort((a, b) => b.data - a.data);

    if (transactions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty"><i class="ti ti-history"></i><p>Nenhuma venda registrada ainda.</p></td></tr>';
      return;
    }

    tbody.innerHTML = transactions
      .map(
        (t) => `
        <tr data-id="${t.id}">
          <td>${formatDate(t.data)}</td>
          <td>${t.cliente || "—"}</td>
          <td>${t.pet || "—"}</td>
          <td>${t.categoria}</td>
          <td>${formatCurrency(t.valorBruto)}</td>
          <td style="color:${t.lucro >= 0 ? "var(--green)" : "var(--red)"}">${formatCurrency(t.lucro)}</td>
          <td>${t.formaPagamento}</td>
          <td class="text-right">
            <button type="button" class="link-btn link-danger btn-remover-venda" data-id="${t.id}">Remover</button>
          </td>
        </tr>`
      )
      .join("");
  }

  function handleTableClick(event) {
    const btn = event.target.closest(".btn-remover-venda");
    if (!btn) return;
    if (confirm("Remover esta venda do histórico? Isso também atualiza o Painel Principal.")) {
      DuoVet.state.removeTransaction(btn.dataset.id);
    }
  }

  function init() {
    const tbody = document.getElementById("historico-tbody");
    if (!tbody) return;
    tbody.addEventListener("click", handleTableClick);
    render();
  }

  return { init, render };
})();
