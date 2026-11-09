import { apiGet } from "../../core/api.js"

export function filtrarSugestoes(nomes, busca) {
  const normalizar = valor => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
  const termo = normalizar(busca.trim())
  if (!termo) return []
  return nomes.filter(nome => normalizar(nome).includes(termo)).slice(0, 5)
}

// Sugestões não selecionam nem substituem o texto que a pessoa digitou.
export function inicializarSugestoesNomes() {
  for (const [campoId, tipo] of [["produtoNovo", "cortes"], ["modeloItem", "modelos"]]) {
    const campo = document.getElementById(campoId)
    if (!campo) continue
    const lista = document.createElement("datalist")
    lista.id = `${campoId}Sugestoes`
    campo.setAttribute("list", lista.id)
    campo.insertAdjacentElement("afterend", lista)
    let nomes = [], buscaAtual = 0
    function mostrar() {
      lista.replaceChildren()
      for (const nome of filtrarSugestoes(nomes, campo.value)) {
        const opcao = document.createElement("option")
        opcao.value = nome
        lista.append(opcao)
      }
    }
    async function carregar() {
      const busca = ++buscaAtual
      try {
        const dados = await apiGet(`/admin/nomenclaturas?${new URLSearchParams({tipo, busca: campo.value.trim()})}`)
        if (busca !== buscaAtual) return
        nomes = dados.nomes.map(item => item.nome)
        mostrar()
      } catch { if (busca === buscaAtual) { nomes = []; mostrar() } }
    }
    let timer
    campo.addEventListener("input", () => {
      buscaAtual++
      mostrar()
      clearTimeout(timer)
      if (campo.value.trim()) timer = setTimeout(carregar, 250)
    })
    campo.addEventListener("focus", () => { clearTimeout(timer); carregar() })
  }
}
