// Mantém uma única tabela e seus eventos; no celular o CSS reorganiza cada registro.
export function inicializarTabelasResponsivas(raiz = document) {
  const observadores = []
  for (const tabela of raiz.querySelectorAll(".table-wrap table")) {
    const cabecalhos = Array.from(tabela.querySelectorAll("thead th"))
    const rotulos = cabecalhos.map(cabecalho => cabecalho.textContent.trim())
    tabela.classList.add("tabela-responsiva")
    tabela.setAttribute("role", "table")
    tabela.closest(".table-wrap").classList.add("tabela-responsiva-wrap")
    cabecalhos.forEach(cabecalho => {
      cabecalho.setAttribute("scope", "col")
      cabecalho.setAttribute("role", "columnheader")
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
            continue
          }
          celula.dataset.label = rotulos[indice] || "Informação"
          celula.classList.toggle("tabela-acoes", /^aç(ão|ões)$/i.test(rotulos[indice] || ""))
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
