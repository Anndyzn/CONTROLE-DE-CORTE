import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete
} from "../../core/api.js"

import {
  mostrarToast
} from "../../core/ui.js"
import { validarValoresItem } from "../../utils/validations.js"
import { limparErroCampo, marcarErroCampo, validarObrigatoriosCampos, marcarErrosNumericos } from "../../core/erros-campos.js"
import { solicitarJustificativa } from "../../admin/justificativa.js"
import { confirmarAcao } from "../../core/confirmacao.js"
import { atualizarVinculosPIs } from "./vinculos.js"
import { carregarPisPendentes } from "./finalizados.js"
import { definirBaseItemRascunho, limparRascunhoGrupo, versaoRascunho } from "./rascunho.js"

import {
  maiusculo,
  formatarNumero,
  formatarQuantidade
} from "../../utils/formatters.js"

import {
  limparCamposItens,
  desabilitarItens
} from "./ui-corte.js"
let salvandoItem=false
let conferindoItens=false


// ========================================
// CARREGAR ITENS DO CORTE
// ========================================

export async function carregarItensCorte(numeroCorte, {aindaAtual = () => true} = {}) {
  try {
    const finalizacao =
      await apiGet(`/cortes/${numeroCorte}/finalizacao-itens`)
    if (!aindaAtual()) return 0

    const itensFinalizados =
      finalizacao.itens_finalizados === 1

    const itens =
      await apiGet(`/itens-corte/${numeroCorte}`)
    if (!aindaAtual()) return 0

    const tabela =
      document.getElementById("listaItensCorte")

    tabela.innerHTML = ""

    if (itens.length === 0) {
      atualizarVinculosPIs(numeroCorte, [], [], {aindaAtual})
      tabela.innerHTML = `
        <tr>
          <td colspan="9">
            Nenhum item encontrado
          </td>
        </tr>
      `

      return 0
    }

    const linhas = []
    itens.forEach((item) => {
      const linha = document.createElement("tr")

      linha.innerHTML = `
        <td></td><td></td><td></td><td></td>
        <td></td><td></td><td></td><td></td>

        <td>
          ${
            itensFinalizados
              ? `
                <span class="status-badge status-default">
                  Bloqueado
                </span>
              `
              : `
                <div class="acoes-item">
                  <button
                    type="button"
                    class="btn-editar-item"
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    class="btn-excluir-item"
                  >
                    Excluir
                  </button>
                </div>
              `
          }
        </td>
      `

      const valores = [maiusculo(item.modelo), maiusculo(item.cor), maiusculo(item.tecido),
        formatarNumero(item.metragem_usada), formatarNumero(item.sobra_metros),
        formatarNumero(item.perda_metros), formatarNumero(item.metros_faltantes),
        formatarQuantidade(item.quantidade_pecas)]
      valores.forEach((valor, indice) => { if (linha.cells?.[indice]) linha.cells[indice].textContent = valor })

      if (!itensFinalizados) {
        configurarEdicao(linha, item)

        configurarExclusao(
          linha,
          item,
          numeroCorte
        )
      }

      tabela.appendChild(linha)
      linhas.push(linha)
    })

    atualizarVinculosPIs(numeroCorte, itens, linhas, {aindaAtual})

    return itens.length

  } catch (erro) {
    console.error(
      "Erro ao carregar itens do corte:",
      erro
    )

    return 0
  }
}


// ========================================
// PREPARAR ITEM PARA EDIÇÃO
// ========================================

function configurarEdicao(linha, item) {
  const botaoEditar =
    linha.querySelector(".btn-editar-item")

  botaoEditar.addEventListener("click", () => {
    definirBaseItemRascunho(item)
    document.getElementById("itemEditandoId").value =
      item.id

    document.getElementById("modeloItem").value =
      item.modelo

    document.getElementById("corItem").value =
      item.cor

    document.getElementById("tecidoItem").value =
      item.tecido

    document.getElementById("metragemItem").value =
      item.metragem_usada

    document.getElementById("sobraItem").value =
      item.sobra_metros

    document.getElementById("perdaItem").value =
      item.perda_metros

    document.getElementById("metrosFaltantesItem").value =
      item.metros_faltantes ?? 0

    document.getElementById("quantidadeItem").value =
      item.quantidade_pecas

    document.getElementById(
      "salvarItemCorte"
    ).textContent = "Atualizar item do corte"

    document.getElementById("modeloItem").focus()
  })
}


// ========================================
// EXCLUIR ITEM
// ========================================

function configurarExclusao(
  linha,
  item,
  numeroCorte
) {
  const botaoExcluir =
    linha.querySelector(".btn-excluir-item")

  botaoExcluir.addEventListener(
    "click",
    async () => {
      const confirmar = await confirmarAcao(
        "Deseja excluir este item do corte?",
        {titulo: "Excluir PI", confirmar: "Excluir PI", perigosa: true}
      )

      if (!confirmar) return

      try {
        const justificativa = await solicitarJustificativa({titulo:"Excluir PI", descricao:`Corte ${numeroCorte}: informe o motivo da exclusão deste PI.`})
        if (!justificativa) return
        await apiDelete(`/itens-corte/${item.id}`, justificativa)

        mostrarToast(
          "Item excluído com sucesso.",
          "sucesso",
          "Item excluído"
        )

        await carregarItensCorte(numeroCorte)

      } catch (erro) {
        console.error(
          "Erro ao excluir item:",
          erro
        )

        mostrarToast(
          erro.message ||
            "Não foi possível excluir o item.",
          "erro",
          "Erro"
        )
      }
    }
  )
}


// ========================================
// SALVAR / ATUALIZAR ITEM
// ========================================

export async function salvarItemCorte({continuar=false}={}) {
  if(salvandoItem)return
  for(const id of ["modeloItem","corItem","corOutra","tecidoItem","tecidoOutro","metragemItem","sobraItem","perdaItem","metrosFaltantesItem","quantidadeItem"])limparErroCampo(id)
  const numeroCorte =
    document.getElementById("numeroCorte").value

  const modelo =
    document
      .getElementById("modeloItem")
      .value
      .trim()

  let cor =
    document.getElementById("corItem").value

  if (cor === "OUTRA") {
    cor =
      document
        .getElementById("corOutra")
        .value
        .trim()
  }

  let tecido =
    document.getElementById("tecidoItem").value

  if (tecido === "OUTRA") {
    tecido =
      document
        .getElementById("tecidoOutro")
        .value
        .trim()
  }

  const metragem =
    document.getElementById("metragemItem").value

  const sobra =
    document.getElementById("sobraItem").value

  const perda =
    document.getElementById("perdaItem").value

  const metrosFaltantes =
    document.getElementById(
      "metrosFaltantesItem"
    ).value

  const quantidade =
    document.getElementById(
      "quantidadeItem"
    ).value


  // ========================================
  // VALIDAÇÕES
  // ========================================

  if (
    !numeroCorte ||
    !modelo ||
    !cor ||
    !tecido ||
    !quantidade
  ) {
    const corCampo=document.getElementById("corItem").value==="OUTRA"?"corOutra":"corItem"
    const tecidoCampo=document.getElementById("tecidoItem").value==="OUTRA"?"tecidoOutro":"tecidoItem"
    validarObrigatoriosCampos({modeloItem:"o modelo",[corCampo]:"a cor",[tecidoCampo]:"o tecido",quantidadeItem:"a quantidade de peças"})
    mostrarToast(
      "Preencha modelo, cor, tecido e quantidade de peças.",
      "atencao",
      "Campos obrigatórios"
    )

    return
  }

  if (metragem === "") {
    marcarErroCampo("metragemItem","Informe a metragem usada. Se for aproveitamento, digite 0.")
    mostrarToast(
      "Informe a metragem usada. Se for aproveitamento, digite 0.",
      "atencao",
      "Metragem obrigatória"
    )

    return
  }


  const erroValores = validarValoresItem({
    metragem, sobra: sobra || 0, perda: perda || 0,
    faltantes: metrosFaltantes || 0, quantidade
  })
  if (erroValores) {
    marcarErrosNumericos({metragemItem:metragem,sobraItem:sobra||0,perdaItem:perda||0,metrosFaltantesItem:metrosFaltantes||0,quantidadeItem:quantidade})
    mostrarToast(erroValores, "atencao", "Valores inválidos")
    return
  }

  const itemEditandoId =
    document.getElementById(
      "itemEditandoId"
    ).value
  if(continuar&&itemEditandoId){mostrarToast("Salve a correção antes de adicionar outro PI.","atencao");return}
  const campos=["modeloItem","corItem","corOutra","tecidoItem","tecidoOutro","metragemItem","sobraItem","perdaItem","metrosFaltantesItem","quantidadeItem"]
  const originais=Object.fromEntries(campos.map(id=>[id,document.getElementById(id).value]))
  const botoes=["salvarItemCorte","salvarOutroItemCorte","finalizarItensCorte"].map(id=>document.getElementById(id)).filter(Boolean)
  const bloqueios=botoes.map(b=>b.disabled)


  const dadosItem = {
    numero_corte: Number(numeroCorte),
    modelo,
    cor,
    tecido,
    metragem_usada: Number(metragem),
    sobra_metros: Number(sobra || 0),
    perda_metros: Number(perda || 0),
    metros_faltantes:
      Number(metrosFaltantes || 0),
    quantidade_pecas: Number(quantidade)
  }


  const versao = versaoRascunho("item", numeroCorte)
  salvandoItem=true
  botoes.forEach(b=>b.disabled=true)
  try {
    if (itemEditandoId) {
      const justificativa = await solicitarJustificativa({titulo:"Corrigir PI", descricao:`Corte ${numeroCorte}: informe o motivo da correção deste PI.`})
      if (!justificativa) return
      await apiPut(
        `/itens-corte/${itemEditandoId}`,
        {...dadosItem, ...justificativa}
      )
    } else {
      await apiPost(
        "/itens-corte",
        dadosItem
      )
    }


    limparRascunhoGrupo("item", numeroCorte, versao)
    if(String(document.getElementById("numeroCorte").value)!==String(numeroCorte))return
    if(campos.some(id=>document.getElementById(id).value!==originais[id])){
      mostrarToast("PI salvo. Os campos que você alterou durante o envio foram mantidos.","sucesso");await carregarItensCorte(numeroCorte);return
    }
    mostrarToast(
      itemEditandoId
        ? "O item do corte foi atualizado."
        : continuar ? "PI salvo. Selecione a cor do próximo PI." : "Item salvo. Adicione outro PI ou registre os itens do corte.",
      "sucesso",
      itemEditandoId
        ? "Item atualizado"
        : "PI adicionado",
      5000
    )


    document.getElementById(
      "itemEditandoId"
    ).value = ""

    document.getElementById(
      "salvarItemCorte"
    ).textContent = "Salvar item do corte"

    limparCamposItens()
    if(continuar){
      document.getElementById("modeloItem").value=originais.modeloItem
      document.getElementById("tecidoItem").value=originais.tecidoItem
      document.getElementById("tecidoOutro").value=originais.tecidoOutro
      document.getElementById("tecidoOutro").style.display=originais.tecidoItem==="OUTRA"?"block":"none"
      document.getElementById("corItem").focus()
    }

    await carregarItensCorte(numeroCorte)
    carregarPisPendentes()

  } catch (erro) {
    console.error(
      "Erro ao salvar item:",
      erro
    )

    mostrarToast(
      erro.message ||
        "Não foi possível salvar o item.",
      "erro",
      "Erro"
    )
  } finally {
    salvandoItem=false
    if(String(document.getElementById("numeroCorte").value)===String(numeroCorte)&&document.getElementById("formItensCorte")?.style.display!=="none")botoes.forEach((b,i)=>b.disabled=bloqueios[i])
  }
}


// ========================================
// FINALIZAR ITENS DO CORTE
// ========================================

export async function finalizarItensCorte() {
  if (conferindoItens || salvandoItem) return
  const numeroCorte =
    document.getElementById("numeroCorte").value

  if (!numeroCorte) {
    mostrarToast(
      "Busque um corte antes de registrar os itens.",
      "atencao",
      "Corte não selecionado"
    )

    return
  }


  conferindoItens=true
  try {
    const itens = await apiGet(`/itens-corte/${numeroCorte}`)
    if (document.getElementById("numeroCorte").value !== numeroCorte) return
    if (!itens.length) { mostrarToast("Cadastre pelo menos um PI antes de confirmar.","atencao"); return }
    const quantidade = itens.reduce((total,item)=>total+Number(item.quantidade_pecas),0)
    const confirmar = await confirmarAcao(
      `${itens.length} PI(s) · ${formatarQuantidade(quantidade)} peças. Confira os dados antes de bloquear os itens para alterações.`,
      {titulo:`Conferir PIs do corte ${numeroCorte}`,confirmar:"Conferir e confirmar PIs",linhas:itens.map(i=>`${i.modelo} · ${i.cor} · ${i.tecido} — ${formatarQuantidade(i.quantidade_pecas)} peças · ${formatarNumero(i.metragem_usada)} m`)}
    )
    if (!confirmar || document.getElementById("numeroCorte").value !== numeroCorte) return
    await apiPost(
      `/cortes/${numeroCorte}/finalizar-itens`
    )

    mostrarToast(
      "Os PIs foram registrados e agora estão bloqueados para alteração.",
      "sucesso",
      "Corte concluído",
      6000
    )

    desabilitarItens()
    carregarPisPendentes()

    await carregarItensCorte(numeroCorte)

  } catch (erro) {
    console.error(
      "Erro ao finalizar itens:",
      erro
    )

    mostrarToast(
      erro.message ||
        "Não foi possível registrar os itens do corte.",
      "erro",
      "Erro"
    )
  } finally { conferindoItens=false }
}


// ========================================
// EVENTOS DOS CAMPOS
// ========================================

export function inicializarItens() {
  const botaoSalvar =
    document.getElementById("salvarItemCorte")

  const botaoFinalizar =
    document.getElementById("finalizarItensCorte")

  const selectCor =
    document.getElementById("corItem")

  const inputCorOutra =
    document.getElementById("corOutra")

  const selectTecido =
    document.getElementById("tecidoItem")

  const inputTecidoOutro =
    document.getElementById("tecidoOutro")


  botaoSalvar.addEventListener(
    "click",
    salvarItemCorte
  )
  document.getElementById("salvarOutroItemCorte")?.addEventListener("click",()=>salvarItemCorte({continuar:true}))

  botaoFinalizar.addEventListener(
    "click",
    finalizarItensCorte
  )


  selectCor.addEventListener(
    "change",
    () => {
      limparErroCampo(inputCorOutra)
      limparErroCampo(selectCor)
      inputCorOutra.style.display =
        selectCor.value === "OUTRA"
          ? "block"
          : "none"
    }
  )


  selectTecido.addEventListener(
    "change",
    () => {
      limparErroCampo(inputTecidoOutro)
      limparErroCampo(selectTecido)
      inputTecidoOutro.style.display =
        selectTecido.value === "OUTRA"
          ? "block"
          : "none"
    }
  )
}
