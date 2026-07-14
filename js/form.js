// form.js — aba "Nova Venda": formulário de registro de atendimento.
// O <select> de categoria é sempre reconstruído a partir de state.js, então
// uma categoria criada/editada na aba "Serviços" aparece aqui imediatamente
// (a mesma fonte de verdade, sem duplicar dados).
window.DuoVet = window.DuoVet || {};

DuoVet.form = (function () {
  const { formatCurrency } = DuoVet.utils;

  function refreshServiceOptions() {
    const select = document.getElementById("venda-servico");
    if (!select) return;

    const previousValue = select.value;
    const categories = DuoVet.state.getCategories();

    // Avisa antes de tentar salvar (não só depois de clicar "Salvar"): sem
    // isso, o form bloqueava o envio via validação nativa do navegador, um
    // aviso fácil de passar despercebido.
    const notice = document.getElementById("venda-sem-servicos");
    if (notice) notice.style.display = categories.length === 0 ? "flex" : "none";

    if (categories.length === 0) {
      select.innerHTML = '<option value="" disabled selected>Cadastre uma categoria na aba "Serviços"...</option>';
      return;
    }

    select.innerHTML =
      '<option value="" disabled selected>Selecione uma categoria...</option>' +
      categories
        .map(
          (c) =>
            `<option value="${c.id}" data-valor="${c.valorPadrao}" data-custo="${c.custoPadrao}" data-nome="${c.nome}">${c.nome} (${formatCurrency(c.valorPadrao)})</option>`
        )
        .join("");

    // Mantém a seleção do usuário se a categoria escolhida ainda existir.
    if ([...select.options].some((o) => o.value === previousValue)) {
      select.value = previousValue;
    }
  }

  function handleServiceChange(event) {
    const option = event.target.selectedOptions[0];
    if (!option || !option.dataset.valor) return;
    document.getElementById("venda-valor").value = option.dataset.valor;
    document.getElementById("venda-custo").value = option.dataset.custo;
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    document.getElementById("toast-text").textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const servicoSelect = document.getElementById("venda-servico");
    const servicoOption = servicoSelect.selectedOptions[0];

    if (!servicoOption || !servicoOption.value) {
      servicoSelect.reportValidity();
      return;
    }

    const entry = {
      cliente: document.getElementById("venda-cliente").value.trim(),
      pet: document.getElementById("venda-pet").value.trim(),
      categoria: servicoOption.dataset.nome,
      valorBruto: parseFloat(document.getElementById("venda-valor").value),
      custo: parseFloat(document.getElementById("venda-custo").value),
      formaPagamento: document.getElementById("venda-pagamento").value,
      data: new Date(),
    };

    // "Insere no banco" simulado — dispara notify() e o Dashboard se
    // atualiza sozinho porque já está inscrito no state.
    DuoVet.state.addTransaction(entry);

    form.reset();
    refreshServiceOptions();
    showToast(`Venda de ${formatCurrency(entry.valorBruto)} registrada com sucesso!`);
  }

  function init() {
    const form = document.getElementById("form-venda");
    const servicoSelect = document.getElementById("venda-servico");
    if (!form || !servicoSelect) return;

    refreshServiceOptions();
    servicoSelect.addEventListener("change", handleServiceChange);
    form.addEventListener("submit", handleSubmit);
  }

  return { init, refreshServiceOptions };
})();
