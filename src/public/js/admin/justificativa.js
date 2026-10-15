export function solicitarJustificativa({ titulo, descricao, numeroConfirmacao = "" }) {
  let dialog = document.getElementById("justificativaAdmin")
  if (!dialog) {
    dialog = document.createElement("dialog")
    dialog.id = "justificativaAdmin"
    dialog.className = "justificativa-dialog"
    dialog.setAttribute("aria-labelledby", "tituloJustificativaAdmin")
    dialog.setAttribute("aria-describedby", "descricaoJustificativaAdmin")
    dialog.innerHTML = `
      <form id="formJustificativaAdmin" method="dialog">
        <h2 id="tituloJustificativaAdmin"></h2>
        <p id="descricaoJustificativaAdmin"></p>
        <div class="form-group">
          <label for="responsavelAdmin">Responsável</label>
          <input id="responsavelAdmin" autocomplete="name" minlength="2" maxlength="100" required>
          <small>Informe seu nome. Ele ficará registrado com a alteração.</small>
        </div>
        <div class="form-group">
          <label for="motivoAdmin">Motivo da alteração</label>
          <textarea id="motivoAdmin" rows="3" minlength="3" maxlength="1000" required placeholder="Explique por que esta ação é necessária."></textarea>
        </div>
        <div id="grupoNumeroConfirmacaoAdmin" class="form-group" hidden>
          <label for="numeroConfirmacaoAdmin">Digite o número do corte para confirmar a exclusão</label>
          <input id="numeroConfirmacaoAdmin" inputmode="numeric" autocomplete="off">
        </div>
        <div class="button-row">
          <button id="cancelarJustificativaAdmin" type="button" class="btn-secondary">Cancelar</button>
          <button type="submit">Confirmar alteração</button>
        </div>
      </form>`
    document.body.append(dialog)
  }
  const form = document.getElementById("formJustificativaAdmin")
  if (dialog.open) return Promise.resolve(null)
  const responsavel = document.getElementById("responsavelAdmin")
  const motivo = document.getElementById("motivoAdmin")
  const numero = document.getElementById("numeroConfirmacaoAdmin")
  form.reset()
  try { responsavel.value = localStorage.getItem("controle-corte:responsavel-admin") || "" } catch {}
  document.getElementById("tituloJustificativaAdmin").textContent = titulo
  document.getElementById("descricaoJustificativaAdmin").textContent = descricao
  document.getElementById("grupoNumeroConfirmacaoAdmin").hidden = !numeroConfirmacao
  numero.required = Boolean(numeroConfirmacao)
  numero.disabled = !numeroConfirmacao
  for (const campo of [responsavel, motivo, numero]) {
    campo.setCustomValidity("")
    campo.oninput = () => campo.setCustomValidity("")
  }

  return new Promise(resolve => {
    let resultado = null
    form.onsubmit = evento => {
      evento.preventDefault()
      responsavel.value = responsavel.value.trim()
      motivo.value = motivo.value.trim()
      responsavel.setCustomValidity(responsavel.value.length < 2 || responsavel.value.length > 100 ? "Informe seu nome (2 a 100 caracteres)." : "")
      motivo.setCustomValidity(motivo.value.length < 3 || motivo.value.length > 1000 ? "Descreva o motivo (3 a 1000 caracteres)." : "")
      numero.setCustomValidity("")
      if (numeroConfirmacao && numero.value.trim() !== String(numeroConfirmacao)) {
        numero.setCustomValidity("Digite o número do corte que será excluído.")
      }
      if (!form.reportValidity()) return
      resultado = { responsavel: responsavel.value, motivo: motivo.value }
      try { localStorage.setItem("controle-corte:responsavel-admin", resultado.responsavel) } catch {}
      dialog.close()
    }
    dialog.onclose = () => resolve(resultado)
    document.getElementById("cancelarJustificativaAdmin").onclick = () => dialog.close()
    dialog.showModal()
    ;(responsavel.value ? motivo : responsavel).focus()
  })
}
