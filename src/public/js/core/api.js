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
    throw new Error(
      dados.erro ||
      "Erro ao salvar dados"
    )
  }

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

  return dados
}

export async function apiDelete(url) {
  const resposta = await fetch(url, {
    method: "DELETE"
  })

  const dados = await resposta.json()

  if (!resposta.ok) {
    throw new Error(dados.erro || "Erro ao excluir dados")
  }

  return dados
}