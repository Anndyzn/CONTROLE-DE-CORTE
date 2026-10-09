import { apiPost } from "../../core/api.js"

import {
  mostrarToast,
  definirCarregamento
} from "../../core/ui.js"

import {
  renderizarStatus,
  desabilitarProducao
} from "./ui-corte.js"

import {
  carregarHistorico
} from "./historico.js"

import {
  carregarCortesEmAndamento
} from "./cortes.js"


const camposProducao =
  [
    "data",
    "turno",
    "operador",
    "operadorOutro",
    "horaInicio",
    "horaFim",
    "folhaParouInput",
    "statusProducao"
  ]


function obterCampo(id) {
  return document.getElementById(id)
}


function limparCampoInvalido(campo) {
  campo
    ?.closest(".form-group")
    ?.classList
    .remove("campo-invalido")
}


function limparErrosValidacaoProducao() {
  camposProducao.forEach((id) => {
    limparCampoInvalido(
      obterCampo(id)
    )
  })
}


function marcarCamposObrigatorios(ids) {
  limparErrosValidacaoProducao()

  ids.forEach((id) => {
    obterCampo(id)
      ?.closest(".form-group")
      ?.classList
      .add("campo-invalido")
  })

  obterCampo(ids[0])
    ?.focus()
}


function obterCamposInvalidos({
  data,
  turno,
  operadorSelecionado,
  operador,
  horaInicio,
  horaFim,
  folhaParou,
  status
}) {
  const camposInvalidos = []

  if (!data) camposInvalidos.push("data")

  if (!turno) camposInvalidos.push("turno")

  if (!operadorSelecionado) {
    camposInvalidos.push("operador")
  } else if (
    operadorSelecionado === "OUTRO" &&
    !operador
  ) {
    camposInvalidos.push("operadorOutro")
  }

  if (!horaInicio) camposInvalidos.push("horaInicio")

  if (!horaFim) camposInvalidos.push("horaFim")

  if (!folhaParou) {
    camposInvalidos.push("folhaParouInput")
  }

  if (!status) {
    camposInvalidos.push("statusProducao")
  }

  return camposInvalidos
}


function obterHoraAtual() {
  const agora = new Date()

  const horas =
    String(
      agora.getHours()
    ).padStart(2, "0")

  const minutos =
    String(
      agora.getMinutes()
    ).padStart(2, "0")

  return `${horas}:${minutos}`
}


function preencherHorarioAtual(idCampo) {
  const campo =
    obterCampo(idCampo)

  if (
    !campo ||
    campo.disabled
  ) {
    return
  }

  campo.value =
    obterHoraAtual()

  limparCampoInvalido(campo)
}


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

  const operadorSelecionado =
    document.getElementById("operador").value

  let operador =
    operadorSelecionado

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

  limparErrosValidacaoProducao()

  if (!numeroCorte) {
    mostrarToast(
      "Selecione um corte antes de registrar a produção.",
      "atencao",
      "Corte obrigatório"
    )

    document
      .getElementById("numeroCorte")
      ?.focus()

    return
  }


  const camposInvalidos =
    obterCamposInvalidos({
      data,
      turno,
      operadorSelecionado,
      operador,
      horaInicio,
      horaFim,
      folhaParou,
      status
    })

  if (camposInvalidos.length > 0) {
    marcarCamposObrigatorios(
      camposInvalidos
    )

    mostrarToast(
      "Preencha os campos destacados antes de salvar.",
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

  let producaoBloqueada = false

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

      producaoBloqueada = true

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
    if (
      producaoBloqueada
    ) {
      botaoSalvar.textContent =
        botaoSalvar.dataset.textoOriginal ||
        "Salvar produção"

      return
    }

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

function limparFormularioProducao({
  limparTurno = false
} = {}) {
  limparErrosValidacaoProducao()

  if (limparTurno) {
    document.getElementById("turno").value = ""
  }

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

      if (selectOperador.value !== "OUTRO") {
        inputOperadorOutro.value = ""
        limparCampoInvalido(
          inputOperadorOutro
        )
      }

      limparCampoInvalido(
        selectOperador
      )
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

      limparCampoInvalido(
        selectStatus
      )
    }
  )
}


function configurarBotoesHorario() {
  const botaoHoraInicio =
    document.getElementById(
      "preencherHoraInicio"
    )

  const botaoHoraFim =
    document.getElementById(
      "preencherHoraFim"
    )

  botaoHoraInicio
    ?.addEventListener(
      "click",
      () => preencherHorarioAtual(
        "horaInicio"
      )
    )

  botaoHoraFim
    ?.addEventListener(
      "click",
      () => preencherHorarioAtual(
        "horaFim"
      )
    )
}


function configurarLimparProducao() {
  const botaoLimpar =
    document.getElementById(
      "limparProducao"
    )

  botaoLimpar
    ?.addEventListener(
      "click",
      () => {
        limparFormularioProducao({
          limparTurno: true
        })

        mostrarToast(
          "Campos do lançamento atual limpos.",
          "info",
          "Lançamento limpo"
        )
      }
    )
}


function configurarValidacaoProducao() {
  camposProducao.forEach((id) => {
    const campo =
      obterCampo(id)

    if (!campo) {
      return
    }

    const limparErro = () => {
      limparCampoInvalido(campo)
    }

    campo.addEventListener(
      "input",
      limparErro
    )

    campo.addEventListener(
      "change",
      limparErro
    )
  })
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

  configurarBotoesHorario()

  configurarLimparProducao()

  configurarValidacaoProducao()
}
