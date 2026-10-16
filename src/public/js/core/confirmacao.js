let pendente = false

export function confirmarAcao(descricao, {titulo = "Confirmar ação", confirmar = "Confirmar", perigosa = false} = {}) {
  // Evita empilhar confirmações ou confirmar duas vezes a mesma ação.
  if (pendente || document.querySelector("dialog[open]")) return Promise.resolve(false)
  let dialog = document.getElementById("confirmacaoSistema")
  if (!dialog) {
    dialog = document.createElement("dialog")
    dialog.id = "confirmacaoSistema"
    dialog.className = "confirmacao-dialog"
    dialog.setAttribute("aria-labelledby", "tituloConfirmacaoSistema")
    dialog.setAttribute("aria-describedby", "descricaoConfirmacaoSistema")
    dialog.innerHTML = `
      <h2 id="tituloConfirmacaoSistema"></h2>
      <p id="descricaoConfirmacaoSistema"></p>
      <div class="confirmacao-acoes">
        <button id="cancelarConfirmacaoSistema" type="button" class="confirmacao-cancelar">Cancelar</button>
        <button id="aceitarConfirmacaoSistema" type="button">Confirmar</button>
      </div>`
    document.body.append(dialog)
  }
  document.getElementById("tituloConfirmacaoSistema").textContent = titulo
  document.getElementById("descricaoConfirmacaoSistema").textContent = descricao
  const aceitar = document.getElementById("aceitarConfirmacaoSistema")
  const cancelar = document.getElementById("cancelarConfirmacaoSistema")
  aceitar.textContent = confirmar
  aceitar.className = perigosa ? "confirmacao-perigosa" : ""

  return new Promise((resolve, reject) => {
    pendente = true
    let confirmado = false
    aceitar.onclick = () => { confirmado = true; dialog.close() }
    cancelar.onclick = () => dialog.close()
    dialog.onclose = () => { pendente = false; resolve(confirmado) }
    try {
      dialog.showModal()
      cancelar.focus()
    } catch (erro) {
      pendente = false
      reject(erro)
    }
  })
}
