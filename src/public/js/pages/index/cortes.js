import { apiGet, apiPost } from "../../core/api.js"

import {
  mostrarToast,
  definirCarregamento
} from "../../core/ui.js"

import {
  maiusculo
} from "../../utils/formatters.js"

import {
  atualizarResumoTopo,
  renderizarStatus,
  limparTabelaHistorico,
  limparTabelaItens,
  limparCamposItens,
  habilitarProducao,
  desabilitarProducao,
  habilitarItens,
  desabilitarItens
} from "./ui-corte.js"

import {
  carregarHistorico
} from "./historico.js"

// Essa importação vai funcionar quando terminarmos itens.js
import {
  carregarItensCorte
} from "./itens.js"


const blocoItensCorte =
  document.getElementById("blocoItensCorte")


export async function carregarFinalizacaoItens(numeroCorte) {
  try {
    const dados =
      await apiGet(`/cortes/${numeroCorte}/finalizacao-itens`)

    return dados.itens_finalizados === 1

  } catch (erro) {
    console.error(
      "Erro ao buscar finalização dos itens:",
      erro
    )

    return false
  }
}


export async function buscarCorte(numeroCorte) {
  blocoItensCorte.style.display = "none"

  document.getElementById("statusProducao").value = ""

  if (!numeroCorte) {
    alert("Digite o número do corte")
    return
  }

  try {

    const dados =
      await apiGet(`/cortes/${numeroCorte}/resumo`)

    document.getElementById("novoCorte").style.display = "none"

    const statusAtual =
      dados.ultima_producao?.status ?? "EM PRODUÇÃO"

    const ultimaFolha =
      dados.ultima_producao?.folha_parou ?? 0

    document.getElementById("produto").textContent =
      maiusculo(dados.corte.produto)

    document.getElementById("mesa").textContent =
      maiusculo(dados.corte.mesa)

    document.getElementById("folhaParou").textContent =
      ultimaFolha

    document.getElementById("folhaInicio").value =
      ultimaFolha

    renderizarStatus(statusAtual)

    atualizarResumoTopo({
      numero: numeroCorte,
      ultimaFolha: String(ultimaFolha),
      status: statusAtual,
      mesa: dados.corte.mesa
    })

    await carregarHistorico(numeroCorte)

    const quantidadeItens =
      await carregarItensCorte(numeroCorte)

    const itensJaFinalizados =
      await carregarFinalizacaoItens(numeroCorte)

    const producaoFinalizada =
      statusAtual === "FINALIZADO"

    if (producaoFinalizada) {
      desabilitarProducao()
    } else {
      habilitarProducao()
    }

    if (itensJaFinalizados) {
      desabilitarItens()
    } else {
      habilitarItens()
    }

    if (producaoFinalizada || quantidadeItens > 0) {
      blocoItensCorte.style.display = "block"
    } else {
      blocoItensCorte.style.display = "none"
    }

  } catch (erro) {

    // Se não encontrou o corte, trata como novo
    if (
      erro.message
        .toLowerCase()
        .includes("não encontrado")
    ) {
      prepararNovoCorte(numeroCorte)
      return
    }

    console.error("Erro ao buscar corte:", erro)

    alert("Erro ao conectar com o servidor")
  }
}


export function prepararNovoCorte(numeroCorte) {

  document.getElementById("produto").textContent = ""
  document.getElementById("mesa").textContent = ""
  document.getElementById("folhaParou").textContent = "0"

  document.getElementById("folhaInicio").value = 0

  renderizarStatus("NOVO CORTE")

  atualizarResumoTopo({
    numero: numeroCorte,
    ultimaFolha: "0",
    status: "NOVO CORTE",
    mesa: "--"
  })

  limparTabelaHistorico()
  limparTabelaItens()
  limparCamposItens()

  document.getElementById("novoCorte").style.display = "block"

  habilitarProducao()
  habilitarItens()
}


export async function carregarCortesEmAndamento() {
  try {

    const cortes =
      await apiGet("/cortes-em-andamento")

    const tabela =
      document.getElementById("cortesEmAndamento")

    tabela.innerHTML = ""

    cortes.forEach((corte) => {

      const statusClasse =
        corte.status === "FINALIZADO"
          ? "status-badge status-finalizado"
          : corte.status === "EM PRODUÇÃO"
          ? "status-badge status-em-producao"
          : "status-badge status-default"

      const linha =
        document.createElement("tr")

      linha.innerHTML = `
        <td>${corte.numero}</td>
        <td>${maiusculo(corte.produto)}</td>
        <td>${maiusculo(corte.mesa)}</td>
        <td>${corte.folha_parou}</td>

        <td>
          <span class="${statusClasse}">
            ${corte.status}
          </span>
        </td>
      `

      linha.style.cursor = "pointer"

      linha.addEventListener("click", async () => {

        document.getElementById("numeroCorte").value =
          corte.numero

        await buscarCorte(corte.numero)
      })

      tabela.appendChild(linha)
    })

  } catch (erro) {

    console.error(
      "Erro ao carregar cortes em andamento:",
      erro
    )
  }
}


export async function gerarProximoNumero() {

  const dados =
    await apiGet("/cortes/proximo-numero")

  return dados.proximo_numero
}


export async function cadastrarCorte({
  numero,
  produto,
  mesa
}) {

  return apiPost(
    "/cortes",
    {
      numero: Number(numero),
      produto,
      mesa
    }
  )
}

export function inicializarCortes() {
  const botaoBuscar =
    document.getElementById("buscarCorte")

  const botaoCadastrar =
    document.getElementById("cadastrarCorte")

  const botaoNovoCorte =
    document.getElementById("gerarProximoCorte")


  // ========================================
  // BUSCAR CORTE
  // ========================================

  botaoBuscar.addEventListener(
    "click",
    async () => {
      const numeroCorte =
        document.getElementById("numeroCorte").value

      await buscarCorte(numeroCorte)
    }
  )


  // ========================================
  // NOVO CORTE / PRÓXIMO NÚMERO
  // ========================================

  botaoNovoCorte.addEventListener(
    "click",
    async () => {
      try {
        definirCarregamento(
          botaoNovoCorte,
          true,
          "Novo corte"
        )

        const proximoNumero =
          await gerarProximoNumero()

        document.getElementById(
          "numeroCorte"
        ).value = proximoNumero

        document.getElementById(
          "produtoNovo"
        ).value = ""

        document.getElementById(
          "mesaNova"
        ).value = ""

        prepararNovoCorte(proximoNumero)

        mostrarToast(
          `Novo corte ${proximoNumero} preparado para cadastro.`,
          "info",
          "Novo corte"
        )

        document.getElementById(
          "produtoNovo"
        ).focus()

      } catch (erro) {
        console.error(
          "Erro ao gerar próximo corte:",
          erro
        )

        mostrarToast(
          erro.message ||
            "Não foi possível consultar o próximo número.",
          "erro",
          "Erro"
        )

      } finally {
        definirCarregamento(
          botaoNovoCorte,
          false,
          "Novo corte"
        )
      }
    }
  )


  // ========================================
  // CADASTRAR CORTE
  // ========================================

  botaoCadastrar.addEventListener(
    "click",
    async () => {
      const numero =
        document.getElementById("numeroCorte").value

      const produto =
        document
          .getElementById("produtoNovo")
          .value
          .trim()

      const mesa =
        document.getElementById("mesaNova").value


      if (!numero || !produto || !mesa) {
        mostrarToast(
          "Preencha número do corte, produto e mesa.",
          "atencao",
          "Campos obrigatórios"
        )

        return
      }


      try {
        await cadastrarCorte({
          numero,
          produto,
          mesa
        })


        mostrarToast(
          `Corte ${numero} cadastrado com sucesso.`,
          "sucesso",
          "Corte cadastrado"
        )


        document.getElementById(
          "novoCorte"
        ).style.display = "none"


        document.getElementById(
          "produtoNovo"
        ).value = ""

        document.getElementById(
          "mesaNova"
        ).value = ""


        // Busca novamente o corte recém-criado
        // para preencher toda a tela corretamente.
        await buscarCorte(numero)

        await carregarCortesEmAndamento()

      } catch (erro) {
        console.error(
          "Erro ao cadastrar corte:",
          erro
        )

        mostrarToast(
          erro.message ||
            "Não foi possível cadastrar o corte.",
          "erro",
          "Erro no cadastro"
        )
      }
    }
  )
}