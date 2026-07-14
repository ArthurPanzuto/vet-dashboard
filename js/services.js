// services.js — aba "Serviços": cadastro das categorias de atendimento, já
// com valor e custo padrão (a categoria é o próprio item vendável, sem um
// "nome de serviço" separado). Alimenta o dropdown da aba "Nova Venda".
window.DuoVet = window.DuoVet || {};

DuoVet.servicesView = (function () {
  const { formatCurrency } = DuoVet.utils;

  let editingId = null;

  function renderTable() {
    const tbody = document.getElementById("servicos-tbody");
    if (!tbody) return;
    const categories = DuoVet.state.getCategories();

    if (categories.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty"><i class="ti ti-tag"></i><p>Nenhuma categoria cadastrada ainda.</p></td></tr>';
      return;
    }

    tbody.innerHTML = categories
      .map(
        (c) => `
        <tr data-id="${c.id}">
          <td><span class="tag-dot" style="background:var(${c.colorVar});display:inline-block;margin-right:6px"></span>${c.nome}</td>
          <td>${formatCurrency(c.valorPadrao)}</td>
          <td>${formatCurrency(c.custoPadrao)}</td>
          <td class="text-right">
            <button type="button" class="link-btn link-edit btn-editar" data-id="${c.id}">Editar</button>
            <button type="button" class="link-btn link-danger btn-remover" data-id="${c.id}" style="margin-left:.75rem">Remover</button>
          </td>
        </tr>`
      )
      .join("");
  }

  function fillFormForEdit(category) {
    editingId = category.id;
    document.getElementById("servico-categoria").value = category.nome;
    document.getElementById("servico-valor").value = category.valorPadrao;
    document.getElementById("servico-custo").value = category.custoPadrao;
    document.getElementById("servico-submit").textContent = "Salvar alterações";
    document.getElementById("servico-cancelar").classList.remove("hidden");
  }

  function resetForm() {
    editingId = null;
    document.getElementById("form-servico").reset();
    document.getElementById("servico-submit").textContent = "Adicionar categoria";
    document.getElementById("servico-cancelar").classList.add("hidden");
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nome = document.getElementById("servico-categoria").value.trim();
    if (!nome) return;

    const entry = {
      nome,
      valorPadrao: parseFloat(document.getElementById("servico-valor").value) || 0,
      custoPadrao: parseFloat(document.getElementById("servico-custo").value) || 0,
    };

    // Digitar o nome de uma categoria que já existe atualiza aquele registro
    // em vez de criar uma segunda categoria duplicada com o mesmo nome.
    const existing = DuoVet.state.getCategories().find(
      (c) => c.id !== editingId && c.nome.toLowerCase() === nome.toLowerCase()
    );
    const targetId = editingId || existing?.id;

    if (targetId) {
      DuoVet.state.updateCategory(targetId, entry);
    } else {
      DuoVet.state.addCategory(entry);
    }
    resetForm();
  }

  function handleTableClick(event) {
    const editBtn = event.target.closest(".btn-editar");
    const removeBtn = event.target.closest(".btn-remover");

    if (editBtn) {
      const category = DuoVet.state.getCategories().find((c) => c.id === editBtn.dataset.id);
      if (category) fillFormForEdit(category);
    }

    if (removeBtn) {
      if (confirm("Remover esta categoria? Vendas já registradas com ela mantêm o nome antigo.")) {
        DuoVet.state.removeCategory(removeBtn.dataset.id);
        if (editingId === removeBtn.dataset.id) resetForm();
      }
    }
  }

  function init() {
    const form = document.getElementById("form-servico");
    const tbody = document.getElementById("servicos-tbody");
    const cancelBtn = document.getElementById("servico-cancelar");
    if (!form || !tbody) return;

    form.addEventListener("submit", handleSubmit);
    tbody.addEventListener("click", handleTableClick);
    cancelBtn.addEventListener("click", resetForm);

    renderTable();
  }

  return { init, render: renderTable };
})();
