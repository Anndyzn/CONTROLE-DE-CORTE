function notificarAlteracao(body) {
  if (body?.responsavel && body?.motivo) {
    document.dispatchEvent(new Event("alteracao-administrativa"))
  }
}

export async function apiGet(url) {
  const resposta = await fetch(url)
  const dados = await resposta.json()

  if (!resposta.ok) {
    throw new Error(dados.erro || "Erro ao buscar dados")
  }

  return dados
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
