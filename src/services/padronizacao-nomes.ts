import { createHash } from "crypto"
import { PoolClient } from "pg"
import dbPg from "../database-pg"
import { ErroRegra } from "./corte-bloqueado"
import { registrarAlteracaoAdmin, validarJustificativa } from "./historico-admin"
import { CorrespondenciaOP, normalizarNome } from "./sankhya-preparacao"

export const categoriasNomes = {
  cortes: {tabela: "cortes", campo: "produto", identificador: "numero", acao: "PADRONIZACAO_PRODUTO"},
  modelos: {tabela: "itens_corte", campo: "modelo", identificador: "id", acao: "PADRONIZACAO_MODELO"}
} as const
export type TipoNome = keyof typeof categoriasNomes
export function tipoNome(valor: unknown): TipoNome {
  if (valor !== "cortes" && valor !== "modelos") throw new ErroRegra(400, "Escolha nomes dos cortes ou modelos dos PIs.")
  return valor
}
export function validarPadronizacao(dados: unknown) {
  const valor = dados as Record<string, unknown> | null
  const tipo = tipoNome(valor?.tipo)
  if (!Array.isArray(valor?.origens) || !valor.origens.length || valor.origens.length > 100
    || valor.origens.some(nome => typeof nome !== "string" || !nome.trim() || nome.length > 200)) {
    throw new ErroRegra(400, "Selecione de 1 a 100 nomes existentes.")
  }
  if (typeof valor?.destino !== "string" || !valor.destino.trim() || valor.destino.trim().length > 200) {
    throw new ErroRegra(400, "Informe o nome padronizado (1 a 200 caracteres).")
  }
  const destino = normalizarNome(valor.destino)
  if (destino.length > 200) throw new ErroRegra(400, "O nome padronizado deve ter no máximo 200 caracteres.")
  const origens = [...new Set(valor.origens as string[])].filter(nome => nome !== destino).sort()
  if (!origens.length) throw new ErroRegra(400, "Selecione pelo menos uma variação diferente do nome padronizado.")
  return {tipo, origens, destino}
}
type Regra = CorrespondenciaOP
const chave = (regra: {modelo: string; tecido: string; cor: string}) => JSON.stringify([regra.modelo, regra.tecido, regra.cor])
const assinaturaDestinos = (regra: Regra) => JSON.stringify(regra.destinos.map(d => [d.codigo_produto, d.produto, d.controle]).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))

// Copiar a correspondência conserva o uso de grafias antigas que não foram selecionadas.
// A regra antiga fica disponível; nenhuma associação diferente é sobrescrita silenciosamente.
export function planejarCorrespondencias(regras: Regra[], origens: string[], destino: string) {
  const modelos = new Set(origens.map(normalizarNome))
  const existentes = new Map(regras.map(regra => [chave(regra), regra]))
  const novas = new Map<string, Regra>()
  for (const regra of regras) {
    if (!modelos.has(regra.modelo) || regra.modelo === destino) continue
    const nova = {...regra, modelo: destino, versao: 1}
    const atual = existentes.get(chave(nova)) ?? novas.get(chave(nova))
    if (atual && assinaturaDestinos(atual) !== assinaturaDestinos(nova)) {
      throw new ErroRegra(409, `Existem correspondências Sankhya diferentes para ${regra.tecido} / ${regra.cor}. Revise-as antes de unir estes modelos.`)
    }
    if (!atual) novas.set(chave(nova), nova)
  }
  return [...novas.values()]
}

export async function consultarPadronizacao(client: PoolClient, pedido: ReturnType<typeof validarPadronizacao>) {
  const config = categoriasNomes[pedido.tipo]
  const campos = pedido.tipo === "cortes" ? "numero, produto" : "id, numero_corte, modelo"
  // Identificadores SQL vêm somente da lista fixa acima; nomes são parâmetros.
  const resultado = await client.query(`SELECT ${campos} FROM ${config.tabela}
    WHERE ${config.campo} = ANY($1::text[]) ORDER BY ${config.identificador} LIMIT 2001`, [pedido.origens])
  if (!resultado.rows.length) throw new ErroRegra(409, "Nenhum registro encontrado. Atualize a lista de nomes.")
  if (resultado.rows.length > 2000) throw new ErroRegra(400, "A seleção ultrapassa 2.000 registros. Padronize menos nomes por vez.")
  const regras = pedido.tipo === "modelos"
    ? (await client.query<Regra>("SELECT modelo, tecido, cor, destinos, versao FROM sankhya_correspondencias ORDER BY modelo, tecido, cor")).rows : []
  const novas = planejarCorrespondencias(regras, pedido.origens, pedido.destino)
  const token = createHash("sha256").update(JSON.stringify({pedido, registros: resultado.rows, regras})).digest("hex")
  const registros = resultado.rows.map(registro => ({
    id: registro[config.identificador], numero_corte: registro.numero_corte ?? registro.numero,
    antes: registro[config.campo], depois: pedido.destino
  }))
  return {token, registros, novas, originais: resultado.rows}
}

export async function previaPadronizacao(dados: unknown) {
  const pedido = validarPadronizacao(dados)
  const client = await dbPg.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
    const previa = await consultarPadronizacao(client, pedido)
    await client.query("COMMIT")
    return {tipo: pedido.tipo, destino: pedido.destino, token: previa.token, registros: previa.registros,
      total: previa.registros.length, cortes: new Set(previa.registros.map(r => r.numero_corte)).size,
      correspondencias: previa.novas.length}
  } catch (erro) { await client.query("ROLLBACK"); throw erro }
  finally { client.release() }
}

export async function aplicarPadronizacao(dados: unknown) {
  const pedido = validarPadronizacao(dados)
  const valor = dados as Record<string, unknown>
  const justificativa = validarJustificativa(valor)
  if (typeof valor.token !== "string" || !/^[a-f0-9]{64}$/.test(valor.token)) throw new ErroRegra(400, "Confira a prévia antes de aplicar.")
  const config = categoriasNomes[pedido.tipo]
  const client = await dbPg.connect()
  try {
    await client.query("BEGIN")
    await client.query("SET LOCAL lock_timeout = '5s'")
    // Inclui operações que usam FOR UPDATE no corte e edições de correspondências.
    // Leitura permanece disponível; a janela de gravação dura somente esta transação.
    await client.query("LOCK TABLE cortes, itens_corte, sankhya_correspondencias IN EXCLUSIVE MODE")
    const previa = await consultarPadronizacao(client, pedido)
    if (previa.token !== valor.token) throw new ErroRegra(409, "Os registros ou correspondências mudaram. Gere uma nova prévia antes de confirmar.")
    for (const regra of previa.novas) {
      await client.query(`INSERT INTO sankhya_correspondencias (modelo, tecido, cor, destinos)
        VALUES ($1, $2, $3, $4::jsonb)`, [regra.modelo, regra.tecido, regra.cor, JSON.stringify(regra.destinos)])
    }
    await client.query(`UPDATE ${config.tabela} SET ${config.campo} = $1 WHERE ${config.campo} = ANY($2::text[])`, [pedido.destino, pedido.origens])
    for (const [indice, antes] of previa.originais.entries()) {
      const depois: Record<string, unknown> = {...antes, [config.campo]: pedido.destino}
      if (indice === 0 && previa.novas.length) depois.correspondencias_sankhya = previa.novas
      await registrarAlteracaoAdmin(client, {...justificativa,
        numero: antes.numero_corte ?? antes.numero, registroId: antes[config.identificador],
        acao: config.acao, antes, depois})
    }
    await client.query("COMMIT")
    return {total: previa.registros.length, correspondencias: previa.novas.length}
  } catch (erro) { await client.query("ROLLBACK"); throw erro }
  finally { client.release() }
}
