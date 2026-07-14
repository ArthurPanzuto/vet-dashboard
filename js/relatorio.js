// relatorio.js — exportação do relatório de faturamento mensal em PDF
// (aba Painel). Usa jsPDF + jspdf-autotable (carregados via CDN no
// index.html) para montar um documento com cabeçalho/logo, cards de resumo
// e tabelas de receitas/despesas do mês escolhido, com paginação automática
// para tabelas longas.
window.DuoVet = window.DuoVet || {};

DuoVet.relatorio = (function () {
  const { formatCurrency, formatDate, monthKey } = DuoVet.utils;

  const MONTH_LABELS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  const COLOR = {
    blue: "#1d6fd1", blueBg: "#eaf3fd",
    amber: "#b45309", amberBg: "#fdf2e3",
    green: "#15803d", greenBg: "#e6f4ea",
    red: "#c22b2b", redBg: "#fbe9e9",
    text: "#111827", muted: "#6b7280", border: "#e2e8f0",
  };

  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    document.getElementById("toast-text").textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function slugify(text) {
    return text.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "");
  }

  function yearsInData() {
    const years = new Set([new Date().getFullYear()]);
    DuoVet.state.getTransactions().forEach((t) => years.add(t.data.getFullYear()));
    DuoVet.state.getDespesas().forEach((d) => years.add(d.data.getFullYear()));
    return [...years].sort((a, b) => b - a);
  }

  function populateSelectors() {
    const mesSelect = document.getElementById("relatorio-mes");
    const anoSelect = document.getElementById("relatorio-ano");
    if (!mesSelect || !anoSelect) return;

    const today = new Date();
    if (!mesSelect.options.length) {
      mesSelect.innerHTML = MONTH_LABELS.map((label, idx) => `<option value="${idx}">${label}</option>`).join("");
      mesSelect.value = String(today.getMonth());
    }

    const previousAno = anoSelect.value;
    anoSelect.innerHTML = yearsInData().map((y) => `<option value="${y}">${y}</option>`).join("");
    anoSelect.value = [...anoSelect.options].some((o) => o.value === previousAno) ? previousAno : String(today.getFullYear());
  }

  // Carrega a logo como data URL via <canvas> em vez de fetch(): fetch() em
  // imagens locais sob file:// é inconsistente entre navegadores, enquanto
  // <img> + canvas funciona de forma confiável nesse cenário.
  function loadLogoDataUrl() {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext("2d").drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/jpeg"));
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = "assets/logo.jpg";
    });
  }

  function drawSummaryCard(doc, x, y, w, h, label, value, accent, accentBg) {
    doc.setFillColor(accentBg);
    doc.roundedRect(x, y, w, h, 6, 6, "F");
    doc.setTextColor(COLOR.muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(label.toUpperCase(), x + 14, y + 20);
    doc.setTextColor(accent);
    doc.setFontSize(16);
    doc.text(value, x + 14, y + 40);
  }

  function ensureSpace(doc, y, needed) {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + needed > pageHeight - 56) {
      doc.addPage();
      return 48;
    }
    return y;
  }

  async function gerarPDF(mes, ano) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 40;
    const contentWidth = pageWidth - marginX * 2;
    const targetKey = `${ano}-${String(mes + 1).padStart(2, "0")}`;

    const transactions = DuoVet.state
      .getTransactions()
      .filter((t) => monthKey(t.data) === targetKey)
      .sort((a, b) => a.data - b.data);
    const despesasMes = DuoVet.state
      .getDespesas()
      .filter((d) => monthKey(d.data) === targetKey)
      .sort((a, b) => a.data - b.data);

    const faturamento = transactions.reduce((sum, t) => sum + t.valorBruto, 0);
    const custoVendas = transactions.reduce((sum, t) => sum + t.custo, 0);
    // Diferente do card "Lucro líquido" do Painel (que não desconta gastos),
    // aqui é o lucro real do mês: receita - custo das vendas - gastos fixos/variáveis.
    const totalGastos = despesasMes.reduce((sum, d) => sum + d.valor, 0);
    const lucroLiquido = faturamento - custoVendas - totalGastos;

    // ---- Cabeçalho ---------------------------------------------------------------
    const logoData = await loadLogoDataUrl();
    if (logoData) {
      doc.addImage(logoData, "JPEG", marginX, 30, 46, 46);
    }
    const textX = marginX + (logoData ? 58 : 0);
    doc.setTextColor(COLOR.text);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("DuoVet — Clínica Veterinária", textX, 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(COLOR.muted);
    doc.text("Relatório de Faturamento Mensal", textX, 66);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(COLOR.text);
    doc.text(`${MONTH_LABELS[mes]} de ${ano}`, pageWidth - marginX, 50, { align: "right" });

    doc.setDrawColor(COLOR.border);
    doc.line(marginX, 92, pageWidth - marginX, 92);

    // ---- Cards de resumo -----------------------------------------------------------
    const cardY = 108;
    const cardH = 56;
    const cardGap = 12;
    const cardW = (contentWidth - cardGap * 2) / 3;
    drawSummaryCard(doc, marginX, cardY, cardW, cardH, "Total Faturado", formatCurrency(faturamento), COLOR.blue, COLOR.blueBg);
    drawSummaryCard(doc, marginX + cardW + cardGap, cardY, cardW, cardH, "Total de Gastos", formatCurrency(totalGastos), COLOR.amber, COLOR.amberBg);
    drawSummaryCard(
      doc,
      marginX + (cardW + cardGap) * 2,
      cardY,
      cardW,
      cardH,
      "Lucro Líquido",
      formatCurrency(lucroLiquido),
      lucroLiquido >= 0 ? COLOR.green : COLOR.red,
      lucroLiquido >= 0 ? COLOR.greenBg : COLOR.redBg
    );

    let y = cardY + cardH + 28;

    // ---- Detalhamento de Receitas ---------------------------------------------------
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(COLOR.text);
    doc.text("Detalhamento de Receitas", marginX, y);
    y += 10;

    if (transactions.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(COLOR.muted);
      doc.text("Nenhuma receita registrada neste mês.", marginX, y + 14);
      y += 30;
    } else {
      doc.autoTable({
        startY: y,
        margin: { left: marginX, right: marginX },
        head: [["Data", "Cliente / Pet", "Tipo de Serviço", "Valor"]],
        body: transactions.map((t) => [
          formatDate(t.data),
          [t.cliente, t.pet].filter(Boolean).join(" / ") || "—",
          t.categoria,
          formatCurrency(t.valorBruto),
        ]),
        styles: { fontSize: 9, cellPadding: 6, textColor: COLOR.text, lineColor: COLOR.border, lineWidth: 0.5 },
        headStyles: { fillColor: COLOR.blue, textColor: "#ffffff", fontStyle: "bold" },
        alternateRowStyles: { fillColor: "#f8fafc" },
        theme: "striped",
      });
      y = doc.lastAutoTable.finalY + 28;
    }

    // ---- Detalhamento de Despesas ----------------------------------------------------
    y = ensureSpace(doc, y, 90);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(COLOR.text);
    doc.text("Detalhamento de Despesas", marginX, y);
    y += 10;

    if (despesasMes.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(COLOR.muted);
      doc.text("Nenhum gasto registrado neste mês.", marginX, y + 14);
    } else {
      doc.autoTable({
        startY: y,
        margin: { left: marginX, right: marginX },
        head: [["Data", "Descrição", "Valor"]],
        body: despesasMes.map((d) => [
          formatDate(d.data),
          d.categoria ? `${d.descricao} (${d.categoria})` : d.descricao,
          formatCurrency(d.valor),
        ]),
        styles: { fontSize: 9, cellPadding: 6, textColor: COLOR.text, lineColor: COLOR.border, lineWidth: 0.5 },
        headStyles: { fillColor: COLOR.amber, textColor: "#ffffff", fontStyle: "bold" },
        alternateRowStyles: { fillColor: "#f8fafc" },
        theme: "striped",
      });
    }

    // ---- Rodapé (todas as páginas) -----------------------------------------------------
    const pageCount = doc.internal.getNumberOfPages();
    const generatedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setDrawColor(COLOR.border);
      doc.line(marginX, pageHeight - 40, pageWidth - marginX, pageHeight - 40);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(COLOR.muted);
      doc.text(`Gerado por DuoVet em ${generatedAt}`, marginX, pageHeight - 26);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - marginX, pageHeight - 26, { align: "right" });
    }

    const fileName = `DuoVet-Relatorio-${slugify(MONTH_LABELS[mes])}-${ano}.pdf`;
    doc.save(fileName);
  }

  async function handleExport() {
    const btn = document.getElementById("btn-exportar-relatorio");
    const mes = parseInt(document.getElementById("relatorio-mes").value, 10);
    const ano = parseInt(document.getElementById("relatorio-ano").value, 10);
    if (Number.isNaN(mes) || Number.isNaN(ano)) return;

    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader-2"></i> Gerando PDF...';
    try {
      await gerarPDF(mes, ano);
      showToast("Relatório PDF gerado com sucesso!");
    } catch (e) {
      console.error("DuoVet: falha ao gerar relatório PDF.", e);
      showToast("Não foi possível gerar o relatório. Veja o console para detalhes.");
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }

  function init() {
    const btn = document.getElementById("btn-exportar-relatorio");
    if (!btn) return;
    populateSelectors();
    btn.addEventListener("click", handleExport);
  }

  function render() {
    populateSelectors();
  }

  return { init, render };
})();
