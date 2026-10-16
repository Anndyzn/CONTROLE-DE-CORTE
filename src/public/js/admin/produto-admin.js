import { apiPut } from "../core/api.js"
import { mostrarToast } from "../core/ui.js"
import { solicitarJustificativa } from "./justificativa.js"

export function inicializarProdutoAdmin() {
  const form = document.getElementById("formProdutoAdmin")
  const editar = document.getElementById("editarProdutoAdmin")
  const cancelar = document.getElementById("cancelarProdutoAdmin")
  const salvar = document.getElementById("salvarProdutoAdmin")
  const campo = document.getElementById("novoProdutoAdmin")
  const resumo = document.getElementById("adminCorteProduto")
  if (!form || !editar || !cancelar || !salvar || !campo || !resumo) return
  let contexto = null, salvando = false

  function fechar() {
    form.hidden = true
    editar.setAttribute("aria-expanded", "false")
    contexto = null
    campo.setCustomValidity("")
  }

  editar.addEventListener("click", () => {
    if (salvando) return
    if (!form.hidden) { fechar(); return }
    contexto = {
      numero: document.getElementById("adminCorteNumero").textContent.trim(),
      produto: resumo.dataset.nomeOriginal
    }
    campo.value = contexto.produto
    form.hidden = false
    editar.setAttribute("aria-expanded", "true")
    campo.focus()
  })
  cancelar.addEventListener("click", () => { if (!salvando) { fechar(); editar.focus() } })
  campo.addEventListener("input", () => campo.setCustomValidity(""))
  document.addEventListener("corte-admin-carregado", fechar)

  form.addEventListener("submit", async evento => {
    evento.preventDefault()
    if (salvando || !contexto) return
    const produto = campo.value.trim().toUpperCase()
    campo.setCustomValidity(!produto || produto.length > 200 ? "Informe o nome do produto (1 a 200 caracteres)." : "")
    if (!form.reportValidity()) return
    if (produto === contexto.produto) { fechar(); return }
    const selecionado = contexto
    salvando = true
    salvar.disabled = cancelar.disabled = editar.disabled = campo.disabled = true
    try {
      const justificativa = await solicitarJustificativa({
        titulo: "Corrigir nome do produto",
        descricao: `Corte ${selecionado.numero}: de “${selecionado.produto}” para “${produto}”. Informe o motivo da correção.`
      })
      if (!justificativa || contexto !== selecionado) return
      salvar.textContent = "Salvando..."
      const dados = await apiPut(`/cortes/${selecionado.numero}/produto`, {
        produto, produto_anterior: selecionado.produto, ...justificativa
      })
      if (contexto === selecionado) {
        resumo.textContent = dados.corte.produto
        resumo.dataset.nomeOriginal = dados.corte.produto
        fechar()
      }
      mostrarToast(`Produto do corte ${selecionado.numero} atualizado.`, "sucesso", "Produto corrigido")
    } catch (erro) {
      mostrarToast(erro.message || "Não foi possível corrigir o produto.", "erro", "Erro na correção")
    } finally {
      salvando = false
      salvar.disabled = cancelar.disabled = editar.disabled = campo.disabled = false
      salvar.textContent = "Salvar produto"
    }
  })
}
