export async function baixarGuiaSankhya(numero) {
  const resposta = await fetch(`/sankhya/cortes/${encodeURIComponent(numero)}/excel`)
  if (!resposta.ok) {
    const erro = await resposta.json().catch(() => ({}))
    throw new Error(erro.erro || "Não foi possível gerar o guia em Excel.")
  }
  const arquivo = await resposta.blob()
  const url = URL.createObjectURL(arquivo)
  const link = document.createElement("a")
  link.href = url
  link.download = `guia-sankhya-corte-${numero}.xlsx`
  document.body.append(link)
  try { link.click() } finally {
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
}
