const consultasEmAndamento = new Map()

function notificarAlteracao(body) {
  // Uma leitura iniciada antes da gravação não deve ser reutilizada depois dela.
  consultasEmAndamento.clear()
  if (body?.responsavel && body?.motivo) {
    document.dispatchEvent(new Event("alteracao-administrativa"))
  }
}

export async function apiGet(url) {
  let consulta = consultasEmAndamento.get(url)
  if (!consulta) {
    consulta = (async () => {
      const resposta = await fetch(url)
      const dados = await resposta.json()
      if (!resposta.ok) throw new Error(dados.erro || "Erro ao buscar dados")
      return dados
    })()
    consultasEmAndamento.set(url, consulta)
  }
  try {
    // Compartilha a rede, mas cada tela recebe seus próprios objetos para edição.
    return structuredClone(await consulta)
  } finally {
    if (consultasEmAndamento.get(url) === consulta) consultasEmAndamento.delete(url)
  }
}

export async function apiPost(
  url,
  body = null
) {
  const configuracao = {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  }

  if (body !== null) {
    configuracao.body =
      JSON.stringify(body)
  }

  const resposta =
    await fetch(url, configuracao)

  const dados =
    await resposta.json()

  if (!resposta.ok) {
    const erro = new Error(
      dados.erro ||
      "Erro ao salvar dados"
    )
    erro.status = resposta.status
    erro.codigo = dados.codigo
    erro.mesa = dados.mesa
    erro.cortes = dados.cortes
    erro.registros = dados.registros
    erro.confirmacao = dados.confirmacao
    throw erro
  }

  notificarAlteracao(body)
  return dados
}

export async function apiPut(url, body) {
  const resposta = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  })

  const dados = await resposta.json()

  if (!resposta.ok) {
    throw new Error(dados.erro || "Erro ao atualizar dados")
  }

  notificarAlteracao(body)
  return dados
}

export async function apiDelete(url, body = null) {
  const configuracao = {
    method: "DELETE"
  }
  if (body !== null) {
    configuracao.headers = { "Content-Type": "application/json" }
    configuracao.body = JSON.stringify(body)
  }
  const resposta = await fetch(url, configuracao)

  const dados = await resposta.json()

  if (!resposta.ok) {
    throw new Error(dados.erro || "Erro ao excluir dados")
  }

  notificarAlteracao(body)
  return dados
}
