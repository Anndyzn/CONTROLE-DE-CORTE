import { apiPost } from "../../core/api.js"

import {
  mostrarToast,
  definirCarregamento
} from "../../core/ui.js"

import {
  atualizarResumoTopo,
  renderizarStatus,
  desabilitarProducao
} from "./ui-corte.js"

import {
  carregarHistorico
} from "./historico.js"

import {
  carregarCortesEmAndamento
} from "./cortes.js"


// ========================================
// REGISTRAR PRODUÇÃO
// ========================================

export async function salvarProducao() {
  const botaoSalvar =
    document.getElementById("salvarProducao")

  const numeroCorte =
    document.getElementById("numeroCorte").value

  const data =
    document.getElementById("data").value

  const turno =
    document.getElementById("turno").value

  let operador =
    document.getElementById("operador").value

  if (operador === "OUTRO") {
    operador =
      document
        .getElementById("operadorOutro")
        .value
        .trim()
  }

  const horaInicio =
    document.getElementById("horaInicio").value

  const horaFim =
    document.getElementById("horaFim").value

  const folhaInicio =
    document.getElementById("folhaInicio").value

  const folhaParou =
    document.getElementById("folhaParouInput").value

  const status =
    document.getElementById("statusProducao").value


  // ========================================
  // VALIDAÇÃO
  // ========================================

  if (
    !numeroCorte ||
    !data ||
    !turno ||
    !operador ||
    !horaInicio ||
    !horaFim ||
    !folhaParou ||
    !status
  ) {
    mostrarToast(
      "Preencha todos os campos obrigatórios antes de salvar.",
      "atencao",
      "Campos obrigatórios"
    )

    return
  }


  const producao = {
    data,
    numero_corte: Number(numeroCorte),
    turno,
    operador,
    hora_inicio: horaInicio,
    hora_fim: horaFim,
    folha_inicio: Number(folhaInicio),
    folha_parou: Number(folhaParou),
    status
  }


  try {
    definirCarregamento(
      botaoSalvar,
      true,
      "Salvar produção"
    )


    await apiPost(
      "/producao",
      producao
    )


    // ========================================
    // AVISO DE SUCESSO
    // ========================================

    mostrarToast(
      status === "FINALIZADO"
        ? "Última produção registrada. Agora informe os PIs cortados."
        : "Produção do turno registrada com sucesso.",

      "sucesso",

      status === "FINALIZADO"
        ? "Produção finalizada"
        : "Lançamento concluído",

      6000
    )


    // ========================================
    // ATUALIZAR TELA
    // ========================================

    document.getElementById("folhaInicio").value =
      folhaParou

    document.getElementById("folhaParou").textContent =
      folhaParou

    renderizarStatus(status)


    atualizarResumoTopo({
      numero: numeroCorte,
      ultimaFolha: folhaParou,
      status,
      mesa:
        document.getElementById("mesa").textContent ||
        "--"
    })


    limparFormularioProducao()


    await carregarHistorico(numeroCorte)

    await carregarCortesEmAndamento()


    // ========================================
    // CORTE FINALIZADO
    // ========================================

    if (status === "FINALIZADO") {
      const blocoItens =
        document.getElementById("blocoItensCorte")

      blocoItens.style.display = "block"

      desabilitarProducao()

      blocoItens.scrollIntoView({
        behavior: "smooth",
        block: "start"
      })
    }

  } catch (erro) {
    console.error(
      "Erro ao salvar produção:",
      erro
    )

    mostrarToast(
      erro.message ||
        "Não foi possível conectar ao servidor.",
      "erro",
      "Erro no lançamento",
      7000
    )

  } finally {
    definirCarregamento(
      botaoSalvar,
      false,
      "Salvar produção"
    )
  }
}


// ========================================
// LIMPAR FORMULÁRIO
// ========================================

function limparFormularioProducao() {
  document.getElementById("folhaParouInput").value = ""

  document.getElementById("horaInicio").value = ""

  document.getElementById("horaFim").value = ""

  document.getElementById("operador").value = ""

  document.getElementById("operadorOutro").value = ""

  document.getElementById(
    "operadorOutro"
  ).style.display = "none"

  document.getElementById(
    "statusProducao"
  ).value = ""
}


// ========================================
// OPERADOR "OUTRO"
// ========================================

function configurarOperadorOutro() {
  const selectOperador =
    document.getElementById("operador")

  const inputOperadorOutro =
    document.getElementById("operadorOutro")

  selectOperador.addEventListener(
    "change",
    () => {
      inputOperadorOutro.style.display =
        selectOperador.value === "OUTRO"
          ? "block"
          : "none"
    }
  )
}


// ========================================
// STATUS DA PRODUÇÃO
// ========================================

function configurarStatus() {
  const selectStatus =
    document.getElementById("statusProducao")

  const blocoItens =
    document.getElementById("blocoItensCorte")

  selectStatus.addEventListener(
    "change",
    () => {
      // Os PIs só aparecem depois
      // que a produção FINALIZADA for salva.
      blocoItens.style.display = "none"
    }
  )
}


// ========================================
// INICIALIZAÇÃO
// ========================================

export function inicializarProducao() {
  const botaoSalvar =
    document.getElementById("salvarProducao")

  botaoSalvar.addEventListener(
    "click",
    salvarProducao
  )

  configurarOperadorOutro()

  configurarStatus()
}