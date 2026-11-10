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
    const lista = document.createElement("div")
    lista.id = `${campoId}Sugestoes`
    lista.className = "nomes-sugestoes"
    lista.setAttribute("role", "group")
    lista.setAttribute("aria-label", "Nomes já cadastrados; selecione uma sugestão")
    const estado = document.createElement("p")
    estado.id = `${campoId}EstadoSugestoes`
    estado.className = "small-help"
    estado.setAttribute("role", "status")
    estado.setAttribute("aria-live", "polite")
    estado.textContent = "Digite para buscar nomes já cadastrados."
    campo.setAttribute("autocomplete", "off")
    campo.setAttribute("aria-describedby", [campo.getAttribute?.("aria-describedby"), estado.id].filter(Boolean).join(" "))
    campo.insertAdjacentElement("afterend", estado)
    campo.insertAdjacentElement("afterend", lista)
    let nomes = [], buscaAtual = 0, selecionando = false
    function mostrar() {
      lista.replaceChildren()
      for (const nome of filtrarSugestoes(nomes, campo.value)) {
        const opcao = document.createElement("button")
        opcao.type = "button"
        opcao.className = "nome-sugestao"
        opcao.value = nome
        opcao.textContent = nome
        opcao.addEventListener("click", () => {
          buscaAtual++; clearTimeout(timer)
          campo.value = nome
          lista.replaceChildren()
          estado.textContent = "Nome cadastrado selecionado."
          selecionando = true
          try { campo.dispatchEvent(new Event("input", {bubbles: true})); campo.focus() }
          finally { selecionando = false }
        })
        lista.append(opcao)
      }
    }
    async function carregar() {
      const busca = ++buscaAtual
      if (!campo.value.trim()) { nomes = []; mostrar(); estado.textContent = "Digite para buscar nomes já cadastrados."; return }
      estado.textContent = "Buscando nomes cadastrados..."
      try {
        const dados = await apiGet(`/admin/nomenclaturas?${new URLSearchParams({tipo, busca: campo.value.trim()})}`)
        if (busca !== buscaAtual) return
        nomes = dados.nomes.map(item => item.nome)
        mostrar()
        estado.textContent = lista.children.length ? "Selecione um nome existente. Se não for o produto desejado, continue digitando." : "Nenhum nome encontrado para essa busca. Confira a escrita; se for um produto novo, pode seguir com o nome digitado."
      } catch { if (busca === buscaAtual) { nomes = []; mostrar(); estado.textContent = "Não foi possível consultar os nomes. Tente novamente para conferir antes de cadastrar." } }
    }
    let timer
    campo.addEventListener("input", () => {
      if (selecionando) return
      buscaAtual++
      mostrar()
      clearTimeout(timer)
      if (campo.value.trim()) timer = setTimeout(carregar, 250)
      estado.textContent = campo.value.trim() ? "Buscando nomes cadastrados..." : "Digite para buscar nomes já cadastrados."
    })
    campo.addEventListener("focus", () => { if (!selecionando) { clearTimeout(timer); return carregar() } })
  }
}
