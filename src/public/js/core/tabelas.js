// Mantém uma única tabela e seus eventos; no celular o CSS reorganiza cada registro.
export function inicializarTabelasResponsivas(raiz = document) {
  const observadores = []
  for (const tabela of raiz.querySelectorAll(".table-wrap table")) {
    const cabecalhos = Array.from(tabela.querySelectorAll("thead th"))
    const rotulos = cabecalhos.map(cabecalho => cabecalho.textContent.trim())
    const tipos = rotulos.map(rotulo => {
      const nome = rotulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      if (/^(metragem|sobra|perda|metros|faltantes|quantidade|pecas|folha|ultima folha|registros)(\b|$)/.test(nome)) return 'numero'
      if (/^(produto|modelo|operador|tecido|observacao|nome existente|nome anterior|nome padronizado)$/.test(nome)) return 'texto'
      return ''
    })
    tabela.classList.add("tabela-responsiva")
    tabela.setAttribute("role", "table")
    tabela.closest(".table-wrap").classList.add("tabela-responsiva-wrap")
    cabecalhos.forEach((cabecalho, indice) => {
      cabecalho.setAttribute("scope", "col")
      cabecalho.setAttribute("role", "columnheader")
      if (tipos[indice]) cabecalho.classList.add(`tabela-${tipos[indice]}`)
    })
    tabela.querySelectorAll("thead, tbody").forEach(grupo => grupo.setAttribute("role", "rowgroup"))
    tabela.querySelectorAll("thead tr").forEach(linha => linha.setAttribute("role", "row"))

    function rotular() {
      for (const linha of tabela.querySelectorAll("tbody tr")) {
        linha.setAttribute("role", "row")
        for (const [indice, celula] of Array.from(linha.cells).entries()) {
          celula.setAttribute("role", "cell")
          if (celula.colSpan > 1) {
            delete celula.dataset.label
            for (const classe of ['tabela-numero', 'tabela-texto', 'tabela-acoes']) celula.classList.toggle(classe, false)
            continue
          }
          celula.dataset.label = rotulos[indice] || "Informação"
          celula.classList.toggle("tabela-acoes", /^aç(ão|ões)$/i.test(rotulos[indice] || ""))
          celula.classList.toggle('tabela-numero', tipos[indice] === 'numero')
          celula.classList.toggle('tabela-texto', tipos[indice] === 'texto')
        }
      }
    }

    rotular()
    const observador = new MutationObserver(rotular)
    observador.observe(tabela, {childList: true, subtree: true})
    observadores.push(observador)
  }
  return () => observadores.forEach(observador => observador.disconnect())
}
