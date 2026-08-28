import {
  apiGet,
  apiPut,
  apiDelete
} from "../core/api.js"

import {
  mostrarToast
} from "../core/ui.js"

import {
  formatarData,
  formatarQuantidade,
  maiusculo
} from "../utils/formatters.js"

import {
  preencherResumoCorteAdmin
} from "./ui-admin.js"


// ========================================
// ABRIR EDIÇÃO
// ========================================

function abrirEdicaoProducao(item) {
  document.getElementById(
    "producaoEditandoId"
  ).value =
    item.id


  document.getElementById(
    "editarData"
  ).value =
    item.data ?? ""


  document.getElementById(
    "editarTurno"
  ).value =
    item.turno ?? ""


  document.getElementById(
    "editarOperador"
  ).value =
    item.operador ?? ""


  document.getElementById(
    "editarHoraInicio"
  ).value =
    item.hora_inicio
      ? String(
          item.hora_inicio
        ).substring(0, 5)
      : ""


  document.getElementById(
    "editarHoraFim"
  ).value =
    item.hora_fim
      ? String(
          item.hora_fim
        ).substring(0, 5)
      : ""


  document.getElementById(
    "editarFolhaInicio"
  ).value =
    item.folha_inicio ?? ""


  document.getElementById(
    "editarFolhaParou"
  ).value =
    item.folha_parou ?? ""


  document.getElementById(
    "editarStatus"
  ).value =
    item.status ?? "EM PRODUÇÃO"


  const formulario =
    document.getElementById(
      "editarProducaoAdmin"
    )


  if (!formulario) {
    return
  }


  formulario.style.display =
    "block"


  formulario.scrollIntoView({
    behavior: "smooth",
    block: "center"
  })
}


// ========================================
// CARREGAR HISTÓRICO
// ========================================

export async function carregarHistoricoAdmin(
  numeroCorte
) {
  try {
    const historico =
      await apiGet(
        `/producao/${numeroCorte}`
      )


    const tabela =
      document.getElementById(
        "historicoAdmin"
      )


    if (!tabela) {
      return
    }


    tabela.innerHTML = ""


    if (historico.length === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="9">
            Nenhum histórico encontrado
          </td>
        </tr>
      `

      return
    }


    historico.forEach((item) => {
      const linha =
        document.createElement("tr")


      linha.innerHTML = `
        <td>
          ${formatarData(item.data)}
        </td>

        <td>
          ${maiusculo(item.turno)}
        </td>

        <td>
          ${maiusculo(item.operador)}
        </td>

        <td>
          ${
            item.hora_inicio
              ? String(
                  item.hora_inicio
                ).substring(0, 5)
              : "-"
          }
        </td>

        <td>
          ${
            item.hora_fim
              ? String(
                  item.hora_fim
                ).substring(0, 5)
              : "-"
          }
        </td>

        <td>
          ${formatarQuantidade(
            item.folha_inicio
          )}
        </td>

        <td>
          ${formatarQuantidade(
            item.folha_parou
          )}
        </td>

        <td>
          ${maiusculo(item.status)}
        </td>

        <td>
        <div class="admin-acoes-tabela">

            <button
            type="button"
            class="btn-editar-producao-admin"
            >
            Editar
            </button>

            <button
            type="button"
            class="btn-excluir-producao-admin"
            >
            Excluir
            </button>

        </div>
        </td>
      `


      const botaoEditar =
        linha.querySelector(
          ".btn-editar-producao-admin"
        )

      const botaoExcluir =
        linha.querySelector(
            ".btn-excluir-producao-admin"
        )


      botaoEditar
        ?.addEventListener(
          "click",
          () => {
            abrirEdicaoProducao(
              item
            )
          }
        )

      botaoExcluir
        ?.addEventListener(
            "click",
            async () => {

            await excluirProducao(
                item
            )

            }
        )

      tabela.appendChild(
        linha
      )
    })
        
  } catch (erro) {
    console.error(
      "Erro ao carregar histórico:",
      erro
    )


    mostrarToast(
      "Não foi possível carregar o histórico do corte.",
      "erro",
      "Erro"
    )
  }
}


// ========================================
// SALVAR EDIÇÃO
// ========================================

async function salvarEdicaoProducao() {
  const id =
    document.getElementById(
      "producaoEditandoId"
    )?.value


  const numeroCorte =
    document.getElementById(
      "numeroCorteAdmin"
    )?.value?.trim()


  const data =
    document.getElementById(
      "editarData"
    )?.value


  const turno =
    document.getElementById(
      "editarTurno"
    )?.value


  const operador =
    document.getElementById(
      "editarOperador"
    )?.value?.trim()


  const horaInicio =
    document.getElementById(
      "editarHoraInicio"
    )?.value


  const horaFim =
    document.getElementById(
      "editarHoraFim"
    )?.value


  const folhaInicio =
    document.getElementById(
      "editarFolhaInicio"
    )?.value


  const folhaParou =
    document.getElementById(
      "editarFolhaParou"
    )?.value


  const status =
    document.getElementById(
      "editarStatus"
    )?.value


  if (
    !id ||
    !data ||
    !turno ||
    !operador ||
    folhaInicio === "" ||
    folhaParou === "" ||
    !status
  ) {
    mostrarToast(
      "Preencha os campos obrigatórios.",
      "atencao",
      "Campos obrigatórios"
    )

    return
  }


  if (
    Number(folhaParou) <
    Number(folhaInicio)
  ) {
    mostrarToast(
      "A folha final não pode ser menor que a folha inicial.",
      "atencao",
      "Folhas inválidas"
    )

    return
  }


  const confirmar =
    confirm(
      "Salvar as alterações deste lançamento?"
    )


  if (!confirmar) {
    return
  }


  try {
    await apiPut(
      `/producao/${id}`,
      {
        data,
        turno,
        operador,

        hora_inicio:
          horaInicio || null,

        hora_fim:
          horaFim || null,

        folha_inicio:
          Number(folhaInicio),

        folha_parou:
          Number(folhaParou),

        status
      }
    )


    mostrarToast(
      "Lançamento atualizado com sucesso.",
      "sucesso",
      "Produção atualizada",
      5000
    )


    const formulario =
      document.getElementById(
        "editarProducaoAdmin"
      )


    if (formulario) {
      formulario.style.display =
        "none"
    }


    await carregarHistoricoAdmin(
      numeroCorte
    )


    const dadosCorte =
      await apiGet(
        `/cortes/${numeroCorte}/resumo`
      )


    preencherResumoCorteAdmin(
      numeroCorte,
      dadosCorte
    )

  } catch (erro) {
    console.error(
      "Erro ao atualizar produção:",
      erro
    )


    mostrarToast(
      erro.message ||
        "Não foi possível atualizar o lançamento.",
      "erro",
      "Erro"
    )
  }
}

// ========================================
// EXCLUIR PRODUÇÃO
// ========================================

async function excluirProducao(
  item
) {
  const numeroCorte =
    document.getElementById(
      "numeroCorteAdmin"
    )
      ?.value
      ?.trim()


  if (!numeroCorte) {
    mostrarToast(
      "Nenhum corte selecionado.",
      "atencao",
      "Corte obrigatório"
    )

    return
  }


  const confirmar =
    confirm(
      `Excluir este lançamento?\n\n` +

      `Corte: ${numeroCorte}\n` +

      `Data: ${
        item.data
          ? formatarData(item.data)
          : "-"
      }\n` +

      `Turno: ${
        maiusculo(
          item.turno ?? "-"
        )
      }\n` +

      `Operador: ${
        maiusculo(
          item.operador ?? "-"
        )
      }\n` +

      `Folhas: ${
        item.folha_inicio ?? "-"
      } → ${
        item.folha_parou ?? "-"
      }\n\n` +

      `Esta ação excluirá o lançamento da produção.`
    )


  if (!confirmar) {
    return
  }


  try {

    await apiDelete(
      `/producao/${item.id}`
    )


    mostrarToast(
      "Lançamento excluído com sucesso.",
      "sucesso",
      "Produção excluída",
      5000
    )


    // ========================================
    // FECHAR FORMULÁRIO DE EDIÇÃO
    // ========================================

    const formulario =
      document.getElementById(
        "editarProducaoAdmin"
      )


    if (formulario) {
      formulario.style.display =
        "none"
    }


    // ========================================
    // ATUALIZAR HISTÓRICO
    // ========================================

    await carregarHistoricoAdmin(
      numeroCorte
    )


    // ========================================
    // ATUALIZAR RESUMO DO CORTE
    // ========================================

    const dadosCorte =
      await apiGet(
        `/cortes/${numeroCorte}/resumo`
      )


    preencherResumoCorteAdmin(
      numeroCorte,
      dadosCorte
    )

  } catch (erro) {

    console.error(
      "Erro ao excluir produção:",
      erro
    )


    mostrarToast(
      erro.message ||
        "Não foi possível excluir o lançamento.",
      "erro",
      "Erro"
    )
  }
}

// ========================================
// INICIALIZAÇÃO
// ========================================

export function inicializarProducaoAdmin() {
  const botaoSalvar =
    document.getElementById(
      "salvarEdicaoProducao"
    )

  const botaoCancelar =
    document.getElementById(
      "cancelarEdicaoProducao"
    )


  botaoSalvar
    ?.addEventListener(
      "click",
      salvarEdicaoProducao
    )


  botaoCancelar
    ?.addEventListener(
      "click",
      () => {
        const formulario =
          document.getElementById(
            "editarProducaoAdmin"
          )


        if (formulario) {
          formulario.style.display =
            "none"
        }
      }
    )
}