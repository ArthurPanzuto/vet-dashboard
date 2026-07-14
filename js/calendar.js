/* DEAD CODE — não utilizado. A implementação real está inline em index.html. Mantido só como histórico. */
// calendar.js — aba "Calendário": grade mensal de eventos, com tipos de
// evento totalmente editáveis (adicionar/remover na própria aba). Mantém
// apenas o mês exibido como estado local; os eventos e tipos vêm sempre de
// DuoVet.state.
window.DuoVet = window.DuoVet || {};

DuoVet.calendar = (function () {
  const { formatDateLong, isSameDay, isSameMonth, dateKey, FALLBACK_COLOR_VAR } = DuoVet.utils;
  const MONTH_LABELS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  let viewDate = new Date(); // mês/ano sendo exibido na grade
  let openDate = null; // dia atualmente aberto no modal (ou null)

  function colorVarFor(nome, list) {
    const found = list.find((item) => item.nome === nome);
    return found ? found.colorVar : FALLBACK_COLOR_VAR;
  }

  // FALLBACK_COLOR_VAR (--t3) não tem uma variante "-l" definida no CSS, então
  // não dá pra montar "var(--t3-l)" como fazemos com as cores da paleta —
  // usamos um par neutro equivalente (--card2/--t3) nesse caso.
  function chipStyleFor(colorVar) {
    if (colorVar === FALLBACK_COLOR_VAR) return "background:var(--card2);color:var(--t3)";
    return `background:var(${colorVar}-l);color:var(${colorVar})`;
  }

  // Monta os 42 dias (6 semanas) exibidos na grade, incluindo dias de
  // preenchimento do mês anterior/seguinte para completar as semanas.
  function buildMonthMatrix(reference) {
    const year = reference.getFullYear();
    const month = reference.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay();
    const gridStart = new Date(year, month, 1 - startOffset);

    const days = [];
    for (let i = 0; i < 42; i++) {
      days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
    }
    return days;
  }

  function eventsOn(date) {
    return DuoVet.state
      .getAppointments()
      .filter((a) => isSameDay(a.data, date))
      .sort((a, b) => a.horario.localeCompare(b.horario));
  }

  function renderLegend() {
    const container = document.getElementById("calendar-legend");
    if (!container) return;
    const eventTypes = DuoVet.state.getEventTypes();
    container.innerHTML = eventTypes
      .map((t) => `<span><span class="cal-dot" style="background:var(${t.colorVar});display:inline-block;margin-right:4px"></span>${t.nome}</span>`)
      .join("");
  }

  function renderGrid() {
    const label = document.getElementById("calendar-month-label");
    const grid = document.getElementById("calendar-grid");
    if (!label || !grid) return;

    label.textContent = `${MONTH_LABELS[viewDate.getMonth()]} de ${viewDate.getFullYear()}`;
    renderLegend();

    const today = new Date();
    const days = buildMonthMatrix(viewDate);
    const eventTypes = DuoVet.state.getEventTypes();

    grid.innerHTML = days
      .map((day) => {
        const inMonth = isSameMonth(day, viewDate);
        const isToday = isSameDay(day, today);
        const dayEvents = eventsOn(day);

        const MAX_CHIPS = 2;
        const chipsHtml = dayEvents
          .slice(0, MAX_CHIPS)
          .map((e) => {
            const label = e.titulo || e.tipoEvento;
            return `<span class="cal-event-chip" style="${chipStyleFor(colorVarFor(e.tipoEvento, eventTypes))}">${label}</span>`;
          })
          .join("");
        const moreHtml =
          dayEvents.length > MAX_CHIPS
            ? `<span class="cal-event-chip cal-event-more">+${dayEvents.length - MAX_CHIPS}</span>`
            : "";

        return `
          <button type="button" data-date="${dateKey(day)}" class="cal-day ${inMonth ? "" : "cal-outside"} ${isToday ? "cal-today" : ""}">
            <span>${day.getDate()}</span>
            ${dayEvents.length ? `<span class="cal-events">${chipsHtml}${moreHtml}</span>` : ""}
          </button>`;
      })
      .join("");

    if (openDate) renderModalList(openDate);
  }

  function renderModalList(date) {
    const list = document.getElementById("calendar-modal-list");
    const title = document.getElementById("calendar-modal-date");
    if (!list || !title) return;

    title.textContent = formatDateLong(date);
    const items = eventsOn(date);
    const eventTypes = DuoVet.state.getEventTypes();

    list.innerHTML = items.length
      ? items
          .map((a) => {
            const varName = colorVarFor(a.tipoEvento, eventTypes);
            const quem = [a.cliente, a.pet].filter(Boolean).join(" · ");
            return `
        <li class="event-item">
          <span class="cal-dot" style="background:var(${varName})"></span>
          <div class="event-info">
            <p class="event-title">${a.horario} — ${a.tipoEvento}: ${a.titulo}</p>
            ${quem ? `<p class="event-meta">${quem}</p>` : ""}
            ${a.observacao ? `<p class="event-obs">${a.observacao}</p>` : ""}
          </div>
          <button type="button" class="link-btn link-danger event-remove-btn" data-id="${a.id}">Remover</button>
        </li>`;
          })
          .join("")
      : '<li class="event-meta" style="padding:.5rem 0">Nenhum evento marcado para este dia.</li>';
  }

  function refreshEventTypeOptions() {
    const select = document.getElementById("agendamento-tipo-evento");
    if (!select) return;
    const previousValue = select.value;
    const eventTypes = DuoVet.state.getEventTypes();

    select.innerHTML = eventTypes.length
      ? eventTypes.map((t) => `<option value="${t.nome}">${t.nome}</option>`).join("")
      : '<option value="" disabled selected>Cadastre um tipo de evento abaixo...</option>';

    if ([...select.options].some((o) => o.value === previousValue)) {
      select.value = previousValue;
    }
  }

  function openModal(date) {
    openDate = date;
    refreshEventTypeOptions();
    renderModalList(date);
    document.getElementById("calendar-modal").classList.remove("hidden");
  }

  function closeModal() {
    openDate = null;
    document.getElementById("calendar-modal").classList.add("hidden");
    document.getElementById("form-agendamento").reset();
  }

  function handleGridClick(event) {
    const btn = event.target.closest(".cal-day");
    if (!btn) return;
    // Reconstrói a data a partir da chave "YYYY-MM-DD" guardada no botão,
    // evitando problemas de fuso horário ao usar new Date(string).
    const [y, m, d] = btn.dataset.date.split("-").map(Number);
    openModal(new Date(y, m - 1, d));
  }

  function handleModalListClick(event) {
    const btn = event.target.closest(".event-remove-btn");
    if (!btn) return;
    DuoVet.state.removeAppointment(btn.dataset.id);
  }

  function handleAddEvent(event) {
    event.preventDefault();
    if (!openDate) return;

    const tipoEvento = document.getElementById("agendamento-tipo-evento").value;
    const titulo = document.getElementById("agendamento-titulo").value.trim();
    if (!tipoEvento || !titulo) return;

    const entry = {
      tipoEvento,
      titulo,
      cliente: document.getElementById("agendamento-cliente").value.trim(),
      pet: document.getElementById("agendamento-pet").value.trim(),
      horario: document.getElementById("agendamento-horario").value,
      observacao: document.getElementById("agendamento-obs").value.trim(),
      data: openDate,
    };

    DuoVet.state.addAppointment(entry);
    event.target.reset();
    refreshEventTypeOptions();
  }

  function prevMonth() {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    renderGrid();
  }

  function nextMonth() {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    renderGrid();
  }

  // ---- Tipos de evento (adicionar/remover) ----------------------------------
  function renderEventTypeList() {
    const container = document.getElementById("tipos-evento-list");
    if (!container) return;
    const eventTypes = DuoVet.state.getEventTypes();

    container.innerHTML = eventTypes.length
      ? eventTypes
          .map(
            (t) => `
        <span class="tag-chip">
          <span class="tag-dot" style="background:var(${t.colorVar})"></span>
          ${t.nome}
          <button type="button" class="tag-remove" data-id="${t.id}" aria-label="Remover tipo ${t.nome}"><i class="ti ti-x"></i></button>
        </span>`
          )
          .join("")
      : '<p style="font-size:12.5px;color:var(--t3)">Nenhum tipo de evento cadastrado.</p>';
  }

  function handleAddEventType(event) {
    event.preventDefault();
    const input = document.getElementById("tipo-evento-nome");
    const nome = input.value.trim();
    if (!nome) return;
    DuoVet.state.addEventType(nome);
    input.value = "";
  }

  function handleEventTypeListClick(event) {
    const btn = event.target.closest(".tag-remove");
    if (!btn) return;
    if (confirm("Remover este tipo de evento? Eventos já marcados com ele mantêm o nome antigo.")) {
      DuoVet.state.removeEventType(btn.dataset.id);
    }
  }

  function init() {
    const grid = document.getElementById("calendar-grid");
    if (!grid) return;

    document.getElementById("calendar-prev").addEventListener("click", prevMonth);
    document.getElementById("calendar-next").addEventListener("click", nextMonth);
    grid.addEventListener("click", handleGridClick);
    document.getElementById("calendar-modal-close").addEventListener("click", closeModal);
    document.getElementById("calendar-modal-list").addEventListener("click", handleModalListClick);
    document.getElementById("form-agendamento").addEventListener("submit", handleAddEvent);
    document.getElementById("form-tipo-evento").addEventListener("submit", handleAddEventType);
    document.getElementById("tipos-evento-list").addEventListener("click", handleEventTypeListClick);

    renderEventTypeList();
    renderGrid();
  }

  function render() {
    renderEventTypeList();
    renderGrid();
  }

  return { init, render };
})();
