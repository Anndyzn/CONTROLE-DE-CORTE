import { apiGet, apiPost } from "../../core/api.js"

import {
  mostrarToast,
  definirCarregamento
} from "../../core/ui.js"

import {
  maiusculo
} from "../../utils/formatters.js"

import {
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

    document.getElementById(
      "numeroCorteSelecionado"
    ).textContent = numeroCorte

    document.getElementById("produto").textContent =
      maiusculo(dados.corte.produto)

    document.getElementById("mesa").textContent =
      maiusculo(dados.corte.mesa)

    document.getElementById("folhaParou").textContent =
      ultimaFolha

    document.getElementById("folhaInicio").value =
      ultimaFolha

    renderizarStatus(statusAtual)

    await carregarHistorico(numeroCorte)

    const quantidadeItens =
      await carregarItensCorte(numeroCorte)

    const itensJaFinalizados =
      await carregarFinalizacaoItens(numeroCorte)

    const producaoFinalizada =
      statusAtual === "FINALIZADO"

    if (producaoFinalizada) {
      desabilitarProducao(
        "FINALIZADO"
      )
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

    setTimeout(() => {

      if (producaoFinalizada) {

        // Corte finalizado:
        // leva direto para PIs / histórico
        const destino =
          document.getElementById(
            "blocoItensCorte"
          )

        destino?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        })

      } else {

        // Corte em produção:
        // leva para o resumo do corte
        const destino =
          document.getElementById(
            "corteSelecionado"
          )

        destino?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        })

      }

    }, 100)

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

  limparTabelaHistorico()
  limparTabelaItens()
  limparCamposItens()

  document.getElementById("novoCorte").style.display = "block"

  habilitarProducao()
  habilitarItens()
  desabilitarProducao(
    "NOVO_CORTE"
  )
}

async function atualizarUltimosCortes() {
  try {
    const todosCortes =
      await apiGet("/consultar-cortes")

    console.log(
      "Cortes para dashboard:",
      todosCortes
    )

    if (
      !Array.isArray(todosCortes) ||
      todosCortes.length === 0
    ) {
      return
    }

    // ==============================
    // ÚLTIMO CORTE
    // ==============================

    const numerosValidos =
      todosCortes
        .map((corte) =>
          Number(corte.numero)
        )
        .filter((numero) =>
          !Number.isNaN(numero)
        )

    if (numerosValidos.length > 0) {
      const ultimoCorte =
        Math.max(...numerosValidos)

      const elemento =
        document.getElementById(
          "resumoUltimoCorte"
        )

      if (elemento) {
        elemento.textContent =
          ultimoCorte
      }
    }

    // ==============================
    // ÚLTIMO FINALIZADO
    // ==============================

    const finalizados =
      todosCortes.filter((corte) => {
        return (
          String(corte.status ?? "")
            .trim()
            .toUpperCase() ===
          "FINALIZADO"
        )
      })

    if (finalizados.length > 0) {
      const numerosFinalizados =
        finalizados
          .map((corte) =>
            Number(corte.numero)
          )
          .filter((numero) =>
            !Number.isNaN(numero)
          )

      if (numerosFinalizados.length > 0) {
        const ultimoFinalizado =
          Math.max(
            ...numerosFinalizados
          )

        const elemento =
          document.getElementById(
            "resumoUltimoFinalizado"
          )

        if (elemento) {
          elemento.textContent =
            ultimoFinalizado
        }
      }
    }

  } catch (erro) {
    // Se o dashboard der erro,
    // NÃO interfere na tabela principal.
    console.error(
      "Erro ao carregar últimos cortes:",
      erro
    )
  }
}

async function atualizarDashboardTopo(cortesEmAndamento) {
  try {
    // ==============================
    // EM ANDAMENTO
    // ==============================

    const resumoEmAndamento =
      document.getElementById("resumoEmAndamento")

    if (resumoEmAndamento) {
      resumoEmAndamento.textContent =
        cortesEmAndamento.length
    }


    // ==============================
    // TODOS OS CORTES
    // ==============================

    const todosCortes =
      await apiGet("/consultar-cortes")


    if (!todosCortes.length) {
      return
    }


    // ==============================
    // ÚLTIMO CORTE
    // ==============================

    const ultimoNumeroCorte =
      Math.max(
        ...todosCortes.map(
          (corte) => Number(corte.numero)
        )
      )


    const resumoUltimoCorte =
      document.getElementById(
        "resumoUltimoCorte"
      )


    if (resumoUltimoCorte) {
      resumoUltimoCorte.textContent =
        ultimoNumeroCorte
    }


    // ==============================
    // ÚLTIMO FINALIZADO
    // ==============================

    const finalizados =
      todosCortes.filter(
        (corte) =>
          String(corte.status)
            .trim()
            .toUpperCase() === "FINALIZADO"
      )


    const resumoUltimoFinalizado =
      document.getElementById(
        "resumoUltimoFinalizado"
      )


    if (finalizados.length === 0) {
      if (resumoUltimoFinalizado) {
        resumoUltimoFinalizado.textContent = "--"
      }

      return
    }


    const ultimoFinalizado =
      Math.max(
        ...finalizados.map(
          (corte) => Number(corte.numero)
        )
      )


    if (resumoUltimoFinalizado) {
      resumoUltimoFinalizado.textContent =
        ultimoFinalizado
    }

  } catch (erro) {
    console.error(
      "Erro ao atualizar resumo do dashboard:",
      erro
    )
  }
}

export async function carregarCortesEmAndamento() {
  try {
    const cortes =
      await apiGet("/cortes-em-andamento")

    const tabela =
      document.getElementById("cortesEmAndamento")

    tabela.innerHTML = ""

    // Atualiza somente a quantidade
    const resumoEmAndamento =
      document.getElementById("resumoEmAndamento")

    if (resumoEmAndamento) {
      resumoEmAndamento.textContent =
        cortes.length
    }

    if (cortes.length === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="6">
            Nenhum corte em andamento
          </td>
        </tr>
      `
    } else {
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

          <td>
            ${maiusculo(corte.produto)}
          </td>

          <td>
            ${maiusculo(corte.mesa)}
          </td>

          <td>
            ${corte.folha_parou ?? 0}
          </td>

          <td>
            <span class="${statusClasse}">
              ${corte.status ?? "-"}
            </span>
          </td>

          <td>
            <button
              type="button"
              class="btn-abrir-corte"
            >
              Abrir
            </button>
          </td>
        `

      linha.style.cursor = "pointer"


      const abrirCorte = async () => {

        // Remove destaque anterior
        document
          .querySelectorAll(
            "#cortesEmAndamento tr"
          )
          .forEach((linhaTabela) => {
            linhaTabela.classList.remove(
              "corte-linha-selecionada"
            )
          })


        // Destaca o corte atual
        linha.classList.add(
          "corte-linha-selecionada"
        )


        // Preenche a busca
        document.getElementById(
          "numeroCorte"
        ).value = corte.numero


        // Carrega o corte
        await buscarCorte(
          corte.numero
        )

      }

      // Clique em qualquer lugar da linha
      linha.addEventListener(
        "click",
        abrirCorte
      )

      // Clique especificamente no botão Abrir
      const botaoAbrir =
        linha.querySelector(
          ".btn-abrir-corte"
        )

      botaoAbrir.addEventListener(
        "click",
        async (evento) => {

          // Evita disparar também
          // o clique da linha
          evento.stopPropagation()

          await buscarCorte(
            corte.numero
          )
        }
      )

        tabela.appendChild(linha)
      })
    }

    // IMPORTANTE:
    // atualiza os outros cards separadamente
    atualizarUltimosCortes()

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

  const campoNumeroCorte =
  document.getElementById(
    "numeroCorte"
  )


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

  // Buscar também com ENTER
  campoNumeroCorte.addEventListener(
    "keydown",
    async (evento) => {

      if (evento.key !== "Enter") {
        return
      }

      evento.preventDefault()

      const numeroCorte =
        campoNumeroCorte.value

      await buscarCorte(
        numeroCorte
      )
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