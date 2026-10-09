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

function definirCorteSelecionadoAtivo(ativo) {
  const botaoLimpar =
    document.getElementById(
      "limparCorteSelecionado"
    )

  if (botaoLimpar) {
    botaoLimpar.disabled =
      !ativo
  }
}


function limparFormularioProducaoVisual() {
  const campos =
    [
      "turno",
      "operador",
      "operadorOutro",
      "horaInicio",
      "horaFim",
      "folhaInicio",
      "folhaParouInput",
      "statusProducao"
    ]


  campos.forEach((id) => {
    const campo =
      document.getElementById(id)

    if (campo) {
      campo.value =
        ""
    }
  })


  const operadorOutro =
    document.getElementById(
      "operadorOutro"
    )

  if (operadorOutro) {
    operadorOutro.style.display =
      "none"
  }


  document
    .querySelectorAll(
      ".producao-card .campo-invalido"
    )
    .forEach((grupo) => {
      grupo.classList.remove(
        "campo-invalido"
      )
    })
}


export function limparCorteSelecionado() {
  document.getElementById("numeroCorte").value = ""
  document.getElementById("produto").textContent = "--"
  document.getElementById("mesa").textContent = "--"
  document.getElementById("folhaParou").textContent = "0"
  document.getElementById("numeroCorteSelecionado").textContent = "--"

  renderizarStatus("--")

  limparTabelaHistorico()
  limparTabelaItens()
  limparCamposItens()
  limparFormularioProducaoVisual()

  document.getElementById("novoCorte").style.display = "none"
  blocoItensCorte.style.display = "none"

  const historicoVazio =
    document.getElementById("historicoVazio")

  if (historicoVazio) {
    historicoVazio.style.display =
      "block"
  }


  const conteudoHistorico =
    document.getElementById("conteudoHistorico")

  if (conteudoHistorico) {
    conteudoHistorico.style.display =
      "none"
  }


  const botaoHistorico =
    document.getElementById("alternarHistorico")

  if (botaoHistorico) {
    botaoHistorico.textContent =
      "Mostrar histórico"
  }


  document
    .querySelectorAll(
      "#cortesEmAndamento tr"
    )
    .forEach((linhaTabela) => {
      linhaTabela.classList.remove(
        "corte-linha-selecionada"
      )
    })


  definirCorteSelecionadoAtivo(false)

  desabilitarProducao(
    "SEM_CORTE"
  )

  document
    .getElementById("numeroCorte")
    ?.focus()
}


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
    mostrarToast(
      "Digite o número do corte para buscar.",
      "atencao",
      "Número obrigatório"
    )

    return
  }

  try {

    const dados =
      await apiGet(`/cortes/${numeroCorte}/resumo`)

    document.getElementById("novoCorte").style.display = "none"

    definirCorteSelecionadoAtivo(true)

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

    mostrarToast(
      "Não foi possível conectar ao servidor.",
      "erro",
      "Erro na busca"
    )
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
  blocoItensCorte.style.display = "none"

  definirCorteSelecionadoAtivo(true)

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

export async function carregarCortesEmAndamento({
  mostrarCarregamento = false,
  avisarErro = false
} = {}) {
  const tabela =
    document.getElementById("cortesEmAndamento")

  if (!tabela) {
    return
  }

  try {
    if (mostrarCarregamento && tabela) {
      tabela.innerHTML = `
        <tr>
          <td colspan="6">
            Carregando cortes em andamento...
          </td>
        </tr>
      `
    }

    const cortes =
      await apiGet("/cortes-em-andamento")

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
      const numeroSelecionado =
        document
          .getElementById(
            "numeroCorteSelecionado"
          )
          ?.textContent
          ?.trim()

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

      if (
        numeroSelecionado &&
        numeroSelecionado !== "--" &&
        String(corte.numero) ===
          numeroSelecionado
      ) {
        linha.classList.add(
          "corte-linha-selecionada"
        )
      }


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

          await abrirCorte()
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

    if (tabela) {
      tabela.innerHTML = `
        <tr>
          <td colspan="6">
            Não foi possível carregar os cortes em andamento.
          </td>
        </tr>
      `
    }

    if (avisarErro) {
      mostrarToast(
        "Não foi possível atualizar os cortes em andamento.",
        "erro",
        "Erro ao atualizar"
      )
    }
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

  const botaoLimparCorte =
    document.getElementById("limparCorteSelecionado")

  const botaoAtualizarCortes =
    document.getElementById(
      "atualizarCortesEmAndamento"
    )

  const campoNumeroCorte =
  document.getElementById(
    "numeroCorte"
  )


  const executarBuscaCorte = async () => {
    const numeroCorte =
      campoNumeroCorte.value

    try {
      definirCarregamento(
        botaoBuscar,
        true,
        "Buscar"
      )

      await buscarCorte(
        numeroCorte
      )

    } finally {
      definirCarregamento(
        botaoBuscar,
        false,
        "Buscar"
      )
    }
  }


  // ========================================
  // BUSCAR CORTE
  // ========================================

  botaoBuscar.addEventListener(
    "click",
    executarBuscaCorte
  )

  // Buscar também com ENTER
  campoNumeroCorte.addEventListener(
    "keydown",
    async (evento) => {

      if (evento.key !== "Enter") {
        return
      }

      evento.preventDefault()

      await executarBuscaCorte()
    }
  )

  botaoLimparCorte
    ?.addEventListener(
      "click",
      limparCorteSelecionado
    )

  botaoAtualizarCortes
    ?.addEventListener(
      "click",
      async () => {
        try {
          definirCarregamento(
            botaoAtualizarCortes,
            true,
            "Atualizar"
          )

          await carregarCortesEmAndamento({
            mostrarCarregamento: true,
            avisarErro: true
          })

        } finally {
          definirCarregamento(
            botaoAtualizarCortes,
            false,
            "Atualizar"
          )
        }
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
        definirCarregamento(
          botaoCadastrar,
          true,
          "Cadastrar corte"
        )

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
      } finally {
        definirCarregamento(
          botaoCadastrar,
          false,
          "Cadastrar corte"
        )
      }
    }
  )
}
