function maiusculo(valor) {
  return valor ? String(valor).toUpperCase() : "-"
}

function formatarDataBR(data) {
  if (!data) return "-"

  const partes = data.split("-")
  return `${partes[2]}/${partes[1]}/${partes[0]}`
}

function definirCarregamento(botao, carregando, textoPadrao) {
  if (!botao) return

  if (carregando) {
    botao.dataset.textoOriginal = botao.textContent
    botao.disabled = true
    botao.textContent = "Processando..."
    return
  }

  botao.disabled = false
  botao.textContent =
    botao.dataset.textoOriginal || textoPadrao || "Salvar"
}

function mostrarToast(
  mensagem,
  tipo = "info",
  titulo = "",
  duracao = 4000
) {
  const container = document.getElementById("toastContainer")

  if (!container) {
    console.error("toastContainer não encontrado no HTML")
    return
  }

  const configuracoes = {
    sucesso: { titulo: "Sucesso", icone: "✓" },
    erro: { titulo: "Erro", icone: "!" },
    atencao: { titulo: "Atenção", icone: "!" },
    info: { titulo: "Informação", icone: "i" }
  }

  const configuracao = configuracoes[tipo] || configuracoes.info

  const toast = document.createElement("div")
  toast.className = `toast toast-${tipo}`

  toast.innerHTML = `
    <div class="toast-icone">${configuracao.icone}</div>

    <div class="toast-conteudo">
      <strong class="toast-titulo">
        ${titulo || configuracao.titulo}
      </strong>

      <span class="toast-mensagem">${mensagem}</span>
    </div>

    <button
    type="button"
    class="toast-fechar"
    aria-label="Fechar notificação"
  >
    &times;
    </button>
  `

  const fecharToast = () => {
    if (toast.classList.contains("saindo")) return

    toast.classList.add("saindo")

    setTimeout(() => {
      toast.remove()
    }, 220)
  }

  toast
    .querySelector(".toast-fechar")
    .addEventListener("click", fecharToast)

  container.appendChild(toast)
  setTimeout(fecharToast, duracao)
}