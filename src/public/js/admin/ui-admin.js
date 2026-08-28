const adminDetalhes =
  document.getElementById(
    "adminDetalhes"
  )


// ========================================
// MOSTRAR DETALHES
// ========================================

export function mostrarDetalhesAdmin() {
  if (!adminDetalhes) {
    return
  }

  adminDetalhes.style.display =
    "grid"
}


// ========================================
// ESCONDER DETALHES
// ========================================

export function esconderDetalhesAdmin() {
  if (!adminDetalhes) {
    return
  }

  adminDetalhes.style.display =
    "none"
}


// ========================================
// LIMPAR TABELAS
// ========================================

export function limparTabelasAdmin() {
  const historico =
    document.getElementById(
      "historicoAdmin"
    )

  const itens =
    document.getElementById(
      "itensAdmin"
    )


  if (historico) {
    historico.innerHTML = ""
  }


  if (itens) {
    itens.innerHTML = ""
  }
}


// ========================================
// PREENCHER CORTE SELECIONADO
// ========================================

export function preencherResumoCorteAdmin(
  numeroCorte,
  dados
) {
  const numero =
    document.getElementById(
      "adminCorteNumero"
    )

  const produto =
    document.getElementById(
      "adminCorteProduto"
    )

  const mesa =
    document.getElementById(
      "adminCorteMesa"
    )

  const status =
    document.getElementById(
      "adminCorteStatus"
    )


  const statusAtual =
    dados.ultima_producao?.status ??
    "EM PRODUÇÃO"


  if (numero) {
    numero.textContent =
      numeroCorte
  }


  if (produto) {
    produto.textContent =
      String(
        dados.corte?.produto ?? "-"
      ).toUpperCase()
  }


  if (mesa) {
    mesa.textContent =
      String(
        dados.corte?.mesa ?? "-"
      ).toUpperCase()
  }


  if (status) {
    const classe =
      statusAtual === "FINALIZADO"
        ? "status-badge status-finalizado"
        : statusAtual === "EM PRODUÇÃO"
        ? "status-badge status-em-producao"
        : "status-badge status-default"


    status.innerHTML = `
      <span class="${classe}">
        ${statusAtual}
      </span>
    `
  }
}