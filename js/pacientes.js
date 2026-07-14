/* DEAD CODE — não utilizado. A implementação real está inline em index.html. Mantido só como histórico. */
// pacientes.js — aba "Pacientes": prontuário clínico. Busca por nome do pet
// ou do tutor, ficha detalhada com dados cadastrais, histórico de consultas
// (timeline) e cartão de vacinação com alertas de dose próxima/vencida.
// Puramente clínico: nada aqui gera transação financeira (isso continua
// sendo feito manualmente em "Nova Venda", se houver cobrança).
window.DuoVet = window.DuoVet || {};

DuoVet.pacientes = (function () {
  const { formatDate, formatDateLong, daysUntil } = DuoVet.utils;

  // ---- Estado local de navegação (não é uma rota real) -----------------------
  let currentView = "busca"; // "busca" | "ficha"
  let activePatientId = null;
  let searchTerm = "";
  let editingPatientId = null; // paciente sendo editado no modal (null = criando novo)

  function todayInputValue() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function openModal(id) {
    document.getElementById(id).classList.remove("hidden");
  }

  function closeModal(id) {
    document.getElementById(id).classList.add("hidden");
  }

  // ---- Busca -------------------------------------------------------------------
  function filteredPatients() {
    const term = searchTerm.trim().toLowerCase();
    const all = DuoVet.state.getPatients();
    if (!term) return all;
    return all.filter(
      (p) => p.nomePet.toLowerCase().includes(term) || p.tutorNome.toLowerCase().includes(term)
    );
  }

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

  function handleSearchInput(event) {
    searchTerm = event.target.value;
    renderSearchResults();
  }

  function handleResultsClick(event) {
    const card = event.target.closest(".patient-card");
    if (!card) return;
    openFicha(card.dataset.id);
  }

  // ---- Modal: Novo/Editar Paciente ----------------------------------------------
  function openNovoPacienteModal() {
    editingPatientId = null;
    document.getElementById("modal-paciente-title").textContent = "Novo Paciente";
    document.getElementById("form-paciente").reset();
    openModal("modal-paciente");
  }

  function openEditarPacienteModal(patient) {
    editingPatientId = patient.id;
    document.getElementById("modal-paciente-title").textContent = "Editar Paciente";
    document.getElementById("paciente-nome-pet").value = patient.nomePet;
    document.getElementById("paciente-especie").value = patient.especie;
    document.getElementById("paciente-raca").value = patient.raca || "";
    document.getElementById("paciente-idade").value = patient.idade || "";
    document.getElementById("paciente-peso").value = patient.peso || "";
    document.getElementById("paciente-sexo").value = patient.sexo || "Macho";
    document.getElementById("paciente-tutor-nome").value = patient.tutorNome;
    document.getElementById("paciente-tutor-telefone").value = patient.tutorTelefone || "";
    document.getElementById("paciente-tutor-cpf").value = patient.tutorCpf || "";
    openModal("modal-paciente");
  }

  function closeNovoPacienteModal() {
    closeModal("modal-paciente");
    document.getElementById("form-paciente").reset();
    editingPatientId = null;
  }

  function handleSubmitPaciente(event) {
    event.preventDefault();
    const entry = {
      nomePet: document.getElementById("paciente-nome-pet").value.trim(),
      especie: document.getElementById("paciente-especie").value.trim(),
      raca: document.getElementById("paciente-raca").value.trim(),
      idade: document.getElementById("paciente-idade").value.trim(),
      peso: parseFloat(document.getElementById("paciente-peso").value) || null,
      sexo: document.getElementById("paciente-sexo").value,
      tutorNome: document.getElementById("paciente-tutor-nome").value.trim(),
      tutorTelefone: document.getElementById("paciente-tutor-telefone").value.trim(),
      tutorCpf: document.getElementById("paciente-tutor-cpf").value.trim(),
    };
    if (!entry.nomePet || !entry.especie || !entry.tutorNome) return;

    if (editingPatientId) {
      DuoVet.state.updatePatient(editingPatientId, entry);
    } else {
      DuoVet.state.addPatient(entry);
    }
    closeNovoPacienteModal();
  }

  // ---- Ficha (troca de sub-view) ------------------------------------------------
  function switchView() {
    document.getElementById("pacientes-busca").classList.toggle("active", currentView === "busca");
    document.getElementById("pacientes-ficha").classList.toggle("active", currentView === "ficha");
  }

  function currentPatient() {
    return DuoVet.state.getPatients().find((p) => p.id === activePatientId);
  }

  function openFicha(patientId) {
    activePatientId = patientId;
    currentView = "ficha";
    switchView();
    renderFicha();
  }

  function backToSearch() {
    currentView = "busca";
    activePatientId = null;
    switchView();
  }

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

  function renderCadastroPanel(patient) {
    const panel = document.getElementById("pac-cadastro-panel");
    if (!panel) return;
    panel.innerHTML = `
      <div class="card-hd">
        <div class="card-title"><i class="ti ti-paw"></i> ${patient.nomePet}</div>
        <button type="button" class="btn-g" id="btn-editar-cadastro"><i class="ti ti-edit"></i> Editar</button>
      </div>
      <div class="card-body">
        <div class="pac-field-group">
          <p class="pac-field"><span>Espécie</span>${patient.especie || "—"}</p>
          <p class="pac-field"><span>Raça</span>${patient.raca || "—"}</p>
          <p class="pac-field"><span>Idade</span>${patient.idade || "—"}</p>
          <p class="pac-field"><span>Peso</span>${patient.peso ? patient.peso + " kg" : "—"}</p>
          <p class="pac-field"><span>Sexo</span>${patient.sexo || "—"}</p>
        </div>
        <div class="pac-field-group" style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">
          <p class="pac-field-title"><i class="ti ti-user"></i> Tutor</p>
          <p class="pac-field"><span>Nome</span>${patient.tutorNome}</p>
          <p class="pac-field"><span>Telefone</span>${patient.tutorTelefone || "—"}</p>
          <p class="pac-field"><span>CPF</span>${patient.tutorCpf || "—"}</p>
        </div>
      </div>`;
    document.getElementById("btn-editar-cadastro").addEventListener("click", () => openEditarPacienteModal(patient));
  }

  function renderUltimaVisita(patient) {
    const container = document.getElementById("pac-ultima-visita");
    if (!container) return;
    const sorted = patient.consultas.slice().sort((a, b) => b.data - a.data);
    const ultima = sorted[0];
    container.innerHTML = `
      <div class="card-body" style="display:flex;align-items:center;gap:.875rem">
        <div class="hero-avatar" style="background:var(--blue-l);color:var(--blue)"><i class="ti ti-clock"></i></div>
        <div>
          <div class="mc-lbl">Última vez que veio</div>
          <div class="mc-val" style="font-size:18px">${ultima ? formatDateLong(ultima.data) : "Nenhuma visita registrada"}</div>
          ${ultima ? `<div class="mc-sub">${ultima.motivo}</div>` : ""}
        </div>
      </div>`;
  }

  function renderConsultasTimeline(patient) {
    const list = document.getElementById("pac-consultas-timeline");
    if (!list) return;
    const sorted = patient.consultas.slice().sort((a, b) => b.data - a.data);

    list.innerHTML = sorted.length
      ? sorted
          .map(
            (c) => `
        <li class="timeline-item" data-id="${c.id}">
          <div class="ti-data">${formatDate(c.data)}</div>
          <div class="ti-motivo">${c.motivo}</div>
          ${c.diagnostico ? `<div class="ti-detail"><strong>Diagnóstico:</strong> ${c.diagnostico}</div>` : ""}
          ${c.prescricao ? `<div class="ti-detail"><strong>Prescrição:</strong> ${c.prescricao}</div>` : ""}
          <button type="button" class="link-btn link-danger btn-remover-consulta" data-id="${c.id}">Remover</button>
        </li>`
          )
          .join("")
      : '<li class="empty"><i class="ti ti-timeline"></i><p>Nenhuma consulta registrada ainda.</p></li>';
  }

  function renderVacinasTable(patient) {
    const tbody = document.getElementById("pac-vacinas-tbody");
    if (!tbody) return;
    const sorted = patient.vacinas.slice().sort((a, b) => b.data - a.data);

    tbody.innerHTML = sorted.length
      ? sorted
          .map(
            (v) => `
        <tr data-id="${v.id}">
          <td>${v.nome}</td>
          <td>${formatDate(v.data)}</td>
          <td>${v.lote || "—"}</td>
          <td class="text-right"><button type="button" class="link-btn link-danger btn-remover-vacina" data-id="${v.id}">Remover</button></td>
        </tr>`
          )
          .join("")
      : '<tr><td colspan="4" class="empty"><i class="ti ti-vaccine"></i><p>Nenhuma vacina registrada ainda.</p></td></tr>';
  }

  function renderVacinaAlerts(patient) {
    const container = document.getElementById("pac-vacina-alerts");
    if (!container) return;

    const alerts = patient.vacinas
      .filter((v) => v.proximaDose)
      .map((v) => ({ vacina: v, dias: daysUntil(v.proximaDose) }))
      .filter((a) => a.dias <= 30)
      .sort((a, b) => a.dias - b.dias);

    if (alerts.length === 0) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = alerts
      .map(({ vacina, dias }) => {
        const vencida = dias < 0;
        return `
        <div class="alert ${vencida ? "alert-danger" : "alert-caution"}">
          <i class="ti ${vencida ? "ti-alert-triangle" : "ti-bell"}"></i>
          <span>Necessita de Vacina: <strong>${vacina.nome}</strong> ${
          vencida ? `— vencida há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}` : `em ${dias} dia${dias === 1 ? "" : "s"}`
        }</span>
        </div>`;
      })
      .join("");
  }

  // ---- Modal: Nova Consulta ------------------------------------------------------
  function openNovaConsultaModal() {
    document.getElementById("form-consulta").reset();
    document.getElementById("consulta-data").value = todayInputValue();
    openModal("modal-consulta");
  }

  function handleSubmitConsulta(event) {
    event.preventDefault();
    if (!activePatientId) return;
    const entry = {
      data: new Date(document.getElementById("consulta-data").value + "T00:00:00"),
      motivo: document.getElementById("consulta-motivo").value.trim(),
      diagnostico: document.getElementById("consulta-diagnostico").value.trim(),
      prescricao: document.getElementById("consulta-prescricao").value.trim(),
    };
    if (!entry.motivo || Number.isNaN(entry.data.getTime())) return;

    DuoVet.state.addConsulta(activePatientId, entry);
    closeModal("modal-consulta");
    document.getElementById("form-consulta").reset();
  }

  // ---- Modal: Nova Vacina ---------------------------------------------------------
  function openNovaVacinaModal() {
    document.getElementById("form-vacina").reset();
    document.getElementById("vacina-data").value = todayInputValue();
    openModal("modal-vacina");
  }

  function handleSubmitVacina(event) {
    event.preventDefault();
    if (!activePatientId) return;
    const proximaDoseRaw = document.getElementById("vacina-proxima-dose").value;
    const entry = {
      nome: document.getElementById("vacina-nome").value.trim(),
      data: new Date(document.getElementById("vacina-data").value + "T00:00:00"),
      lote: document.getElementById("vacina-lote").value.trim(),
      proximaDose: proximaDoseRaw ? new Date(proximaDoseRaw + "T00:00:00") : null,
    };
    if (!entry.nome || Number.isNaN(entry.data.getTime())) return;

    DuoVet.state.addVacina(activePatientId, entry);
    closeModal("modal-vacina");
    document.getElementById("form-vacina").reset();
  }

  // ---- Remoção (consulta/vacina) via delegação de evento --------------------------
  function handleTimelineClick(event) {
    const btn = event.target.closest(".btn-remover-consulta");
    if (!btn || !activePatientId) return;
    if (confirm("Remover esta consulta do histórico do paciente?")) {
      DuoVet.state.removeConsulta(activePatientId, btn.dataset.id);
    }
  }

  function handleVacinasClick(event) {
    const btn = event.target.closest(".btn-remover-vacina");
    if (!btn || !activePatientId) return;
    if (confirm("Remover esta vacina do cartão de vacinação?")) {
      DuoVet.state.removeVacina(activePatientId, btn.dataset.id);
    }
  }

  // ---- init/render (chamados por main.js) ------------------------------------------
  function init() {
    const root = document.getElementById("tab-pacientes");
    if (!root) return;

    document.getElementById("pacientes-search-input").addEventListener("input", handleSearchInput);
    document.getElementById("pacientes-results").addEventListener("click", handleResultsClick);
    document.getElementById("btn-novo-paciente").addEventListener("click", openNovoPacienteModal);
    document.getElementById("modal-paciente-close").addEventListener("click", closeNovoPacienteModal);
    document.getElementById("form-paciente").addEventListener("submit", handleSubmitPaciente);
    document.getElementById("btn-voltar-busca").addEventListener("click", backToSearch);

    document.getElementById("btn-nova-consulta").addEventListener("click", openNovaConsultaModal);
    document.getElementById("modal-consulta-close").addEventListener("click", () => closeModal("modal-consulta"));
    document.getElementById("form-consulta").addEventListener("submit", handleSubmitConsulta);
    document.getElementById("pac-consultas-timeline").addEventListener("click", handleTimelineClick);

    document.getElementById("btn-nova-vacina").addEventListener("click", openNovaVacinaModal);
    document.getElementById("modal-vacina-close").addEventListener("click", () => closeModal("modal-vacina"));
    document.getElementById("form-vacina").addEventListener("submit", handleSubmitVacina);
    document.getElementById("pac-vacinas-tbody").addEventListener("click", handleVacinasClick);

    switchView();
    renderSearchResults();
  }

  function render() {
    if (currentView === "busca") renderSearchResults();
    else renderFicha();
  }

  return { init, render };
})();
