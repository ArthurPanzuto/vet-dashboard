/* DEAD CODE — não utilizado. A implementação real está inline em index.html. Mantido só como histórico. */
// utils.js — funções puras de formatação e cálculo, reaproveitadas por todos os módulos.
window.DuoVet = window.DuoVet || {};

DuoVet.utils = (function () {
  const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const MONTH_LABELS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  // Paleta de cores (nomes de tokens CSS — ver css/styles.css) atribuída
  // automaticamente a cada nova categoria de serviço ou tipo de evento, na
  // ordem em que são criados. A cor fica fixa no próprio registro (categoria/
  // tipo) desde a criação — remover um item no meio da lista não desloca a
  // cor dos demais.
  const PALETTE_VARS = ["--blue", "--green", "--violet", "--amber", "--red"];
  function nextPaletteVar(existingCount) {
    return PALETTE_VARS[existingCount % PALETTE_VARS.length];
  }
  // Cor neutra para itens cuja categoria/tipo de evento original foi apagado.
  const FALLBACK_COLOR_VAR = "--t3";

  // Gera um id simples e único o bastante para uma simulação em memória
  // (timestamp + número aleatório evita colisão sem precisar de uma lib externa).
  function generateId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  }

  function formatDateLong(date) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  // Retorna uma data às 00:00 (sem hora), útil para comparar "dia" sem ruído de horário.
  function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  }

  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function isSameMonth(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  }

  // Diferença em dias inteiros entre hoje e `date` (positivo = no futuro,
  // negativo = já passou). Usa startOfDay nos dois lados para não sofrer
  // ruído de horário/DST na divisão.
  function daysUntil(date) {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const today = startOfDay(new Date());
    const target = startOfDay(date);
    return Math.round((target - today) / MS_PER_DAY);
  }

  // Chave estável "YYYY-MM-DD" usada para agrupar/comparar datas sem fuso/hora.
  function dateKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  }

  // Chave estável "YYYY-MM" usada para agrupar transações por mês.
  function monthKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function formatPercent(value, decimals = 1) {
    return `${value.toFixed(decimals)}%`;
  }

  return {
    WEEKDAY_LABELS,
    MONTH_LABELS_SHORT,
    PALETTE_VARS,
    FALLBACK_COLOR_VAR,
    nextPaletteVar,
    generateId,
    formatCurrency,
    formatDate,
    formatDateLong,
    formatPercent,
    startOfDay,
    addDays,
    addMonths,
    isSameDay,
    isSameMonth,
    daysUntil,
    dateKey,
    monthKey,
  };
})();
