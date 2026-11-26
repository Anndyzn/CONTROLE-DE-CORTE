export function definirCarregamento(
  botao,
  carregando,
  textoOriginal = "Salvar"
) {
  if (!botao) return

  if (carregando) {
    botao.disabled = true
    if (botao.dataset.carregando !== '1') {
      botao.dataset.textoOriginal = botao.textContent
      botao.dataset.larguraAnterior = botao.style.minWidth
      const largura = botao.getBoundingClientRect().width
      if (largura > 0) botao.style.minWidth = `${largura}px`
    }
    botao.dataset.carregando = '1'
    botao.setAttribute('aria-busy', 'true')

    botao.textContent = "Aguarde..."
  } else {
    botao.disabled = false

    botao.textContent =
      botao.dataset.textoOriginal ||
      textoOriginal
    if (botao.dataset.carregando === '1') botao.style.minWidth = botao.dataset.larguraAnterior || ''
    delete botao.dataset.carregando
    botao.setAttribute('aria-busy', 'false')
  }
}


export function mostrarToast(
  mensagem,
  tipo = "info",
  titulo = "",
  duracao = 4000
) {
  const container =
    document.getElementById("toastContainer")

  if (!container) {
    console.warn(
      "toastContainer não encontrado"
    )

    return
  }

  const configuracoes = {
    sucesso: {
      titulo: "Sucesso",
      icone: "✓"
    },

    erro: {
      titulo: "Erro",
      icone: "!"
    },

    atencao: {
      titulo: "Atenção",
      icone: "!"
    },

    info: {
      titulo: "Informação",
      icone: "i"
    }
  }

  const configuracao =
    configuracoes[tipo] ||
    configuracoes.info

  const toast =
    document.createElement("div")

  toast.className =
    `toast toast-${tipo}`

  toast.innerHTML = `
    <div class="toast-icone">
      ${configuracao.icone}
    </div>

    <div class="toast-conteudo">
      <strong class="toast-titulo">
        ${titulo || configuracao.titulo}
      </strong>

      <span class="toast-mensagem">
        ${mensagem}
      </span>
    </div>

    <button
      type="button"
      class="toast-fechar"
      aria-label="Fechar notificação"
    >
      ×
    </button>
  `

  const fecharToast = () => {
    if (
      toast.classList.contains("saindo")
    ) {
      return
    }

    toast.classList.add("saindo")

    setTimeout(() => {
      toast.remove()
    }, 220)
  }

  toast
    .querySelector(".toast-fechar")
    .addEventListener(
      "click",
      fecharToast
    )

  container.appendChild(toast)

  setTimeout(
    fecharToast,
    duracao
  )
}
