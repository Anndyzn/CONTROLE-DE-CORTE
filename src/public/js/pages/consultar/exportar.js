import { mostrarToast } from "../../core/ui.js"

export async function baixarExcel(parametros) {
  const resposta = await fetch(`/consultar-cortes/exportar?${parametros}`)
  if (!resposta.ok) {
    const dados = await resposta.json().catch(() => ({}))
    throw new Error(dados.erro || "Não foi possível gerar o Excel.")
  }
  const arquivo = await resposta.blob()
  const url = URL.createObjectURL(arquivo)
  const link = document.createElement("a")
  link.href = url
  link.download = resposta.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] || "relatorio-cortes.xlsx"
  document.body.append(link)
  try { link.click() } finally {
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
}

export function inicializarExportacao(obterConsulta) {
  const botao = document.getElementById("exportarExcel")
  let exportando = false
  function atualizar() {
    if (botao) botao.disabled = exportando || obterConsulta() === null
  }
  botao?.addEventListener("click", async () => {
    const parametros = obterConsulta()
    if (exportando || parametros === null) return
    exportando = true
    atualizar()
    botao.textContent = "Gerando Excel..."
    try {
      await baixarExcel(parametros)
      mostrarToast("Excel gerado. Confira os downloads do navegador.", "sucesso", "Relatório exportado")
    } catch (erro) {
      mostrarToast(erro.message, "erro", "Erro ao exportar")
    } finally {
      exportando = false
      botao.textContent = "📥 Exportar Excel"
      atualizar()
    }
  })
  return atualizar
}
