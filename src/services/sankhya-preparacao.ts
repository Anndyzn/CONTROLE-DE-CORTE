import dbPg from "../database-pg"
import { ErroRegra } from "./corte-bloqueado"
import { conferirDestinoCatalogo } from "./sankhya-catalogo"

export type DestinoOP = { codigo_produto: number; produto: string; controle: string }
export type CorrespondenciaOP = { modelo: string; tecido: string; cor: string; destinos: DestinoOP[]; versao: number }
type ItemCorte = { id: number; modelo: string; tecido: string; cor: string; quantidade_pecas: number | string; metragem_usada: number | string }

export const normalizarNome = (valor: string) => valor.trim().replace(/\s+/g, " ").toUpperCase()
const chave = (item: {modelo: string; tecido: string; cor: string}) => JSON.stringify(
  [item.modelo, item.tecido, item.cor].map(normalizarNome)
)

function texto(valor: unknown, rotulo: string, limite = 200) {
  if (typeof valor !== "string" || !valor.trim() || valor.trim().length > limite) {
    throw new ErroRegra(400, `Informe ${rotulo} (1 a ${limite} caracteres).`)
  }
  return valor.trim().replace(/\s+/g, " ")
}

export function validarCorrespondencia(dados: unknown): CorrespondenciaOP {
  if (!dados || typeof dados !== "object") throw new ErroRegra(400, "Informe a correspondência.")
  const valor = dados as Record<string, unknown>
  const modelo = normalizarNome(texto(valor.modelo, "o modelo"))
  const tecido = normalizarNome(texto(valor.tecido, "o tecido"))
  const cor = normalizarNome(texto(valor.cor, "a cor"))
  if (!Number.isSafeInteger(valor.versao) || Number(valor.versao) < 0) {
    throw new ErroRegra(400, "Recarregue a correspondência antes de salvar.")
  }
  if (!Array.isArray(valor.destinos) || valor.destinos.length < 1 || valor.destinos.length > 10) {
    throw new ErroRegra(400, "Cadastre de 1 a 10 produtos de destino.")
  }
  const vistos = new Set<string>()
  const destinos = valor.destinos.map((destino: unknown) => {
    if (!destino || typeof destino !== "object") throw new ErroRegra(400, "Produto de destino inválido.")
    const d = destino as Record<string, unknown>
    if (!Number.isSafeInteger(d.codigo_produto) || Number(d.codigo_produto) <= 0 || Number(d.codigo_produto) > 2147483647) {
      throw new ErroRegra(400, "Informe um código de produto inteiro e positivo.")
    }
    // O controle é um identificador do ERP: conservar a grafia informada.
    if (d.controle != null && (typeof d.controle !== "string" || d.controle.trim().length > 100)) {
      throw new ErroRegra(400, "O controle de cor deve ser um texto de até 100 caracteres, ou ficar vazio.")
    }
    const controle = typeof d.controle === "string" ? d.controle.trim().replace(/\s+/g, " ") : ""
    const identificador = String(d.codigo_produto)
    if (vistos.has(identificador)) throw new ErroRegra(400, "Produtos repetidos: escolha apenas um controle de cada produto por PI. Registre outras variações em itens separados.")
    vistos.add(identificador)
    return conferirDestinoCatalogo({codigo_produto: Number(d.codigo_produto), controle})
  })
  return {modelo, tecido, cor, destinos, versao: Number(valor.versao)}
}

export function montarConferencia(itens: ItemCorte[], correspondencias: CorrespondenciaOP[]) {
  const regras = new Map(correspondencias.map(regra => [chave(regra), regra]))
  return itens.map(item => {
    const regra = regras.get(chave(item))
    const quantidade = Number(item.quantidade_pecas)
    const pendencias: string[] = []
    if (!regra) pendencias.push("Cadastre os produtos e controles correspondentes no Sankhya.")
    if (!Number.isSafeInteger(quantidade) || quantidade <= 0) pendencias.push("A quantidade de peças deve ser inteira e maior que zero para preparar uma OP.")
    let destinos: DestinoOP[] = []
    if (regra) {
      try {
        if (new Set(regra.destinos.map(d => d.codigo_produto)).size !== regra.destinos.length) {
          throw new ErroRegra(400, "Revise o vínculo antigo: selecione apenas o controle cortado de cada produto, em vez de todas as variações.")
        }
        destinos = regra.destinos.map(conferirDestinoCatalogo)
      } catch (erro) {
        if (!(erro instanceof ErroRegra)) throw erro
        pendencias.push(erro.message)
      }
    }
    return {
      ...item,
      correspondencia: regra ? {...regra, destinos: destinos.length ? destinos : regra.destinos} : null,
      pendencias,
      // Cada destino recebe a quantidade do item. Consumo total nunca é duplicado entre OPs.
      ordens: pendencias.length ? [] : destinos.map(destino => ({...destino, quantidade}))
    }
  })
}

export async function carregarConferenciaSankhya(numero: number, {exigirFinalizacao = true} = {}) {
  const client = await dbPg.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
    const resultado = await client.query(`SELECT c.numero, c.produto, c.itens_finalizados,
      (SELECT p.status FROM producao p WHERE p.numero_corte = c.numero ORDER BY p.id DESC LIMIT 1) AS status
      FROM cortes c WHERE c.numero = $1`, [numero])
    const corte = resultado.rows[0]
    if (!corte) throw new ErroRegra(404, "Corte não encontrado.")
    const finalizado = corte.status === "FINALIZADO" && Number(corte.itens_finalizados) === 1
    if (exigirFinalizacao && !finalizado) {
      throw new ErroRegra(409, "Finalize a produção e confirme os PIs antes de preparar as OPs.")
    }
    const itens = await client.query("SELECT id, modelo, cor, tecido, quantidade_pecas, metragem_usada FROM itens_corte WHERE numero_corte = $1 ORDER BY id", [numero])
    if (!itens.rows.length) throw new ErroRegra(409, "Este corte não possui itens para conferir.")
    const regras = await client.query<CorrespondenciaOP>(
      "SELECT modelo, tecido, cor, destinos, versao FROM sankhya_correspondencias WHERE modelo = ANY($1::text[])",
      [[...new Set(itens.rows.map(item => normalizarNome(item.modelo)))]]
    )
    const conferencia = montarConferencia(itens.rows, regras.rows)
    await client.query("COMMIT")
    const total = conferencia.reduce((total, item) => total + item.ordens.length, 0)
    const completa = conferencia.every(item => item.pendencias.length === 0)
    return {corte, itens: conferencia, total_ops: total, completa,
      guia_disponivel: finalizado && completa && total > 0, envio_disponivel: false}
  } catch (erro) { await client.query("ROLLBACK"); throw erro }
  finally { client.release() }
}

export async function prepararCorrespondenciasSankhya() {
  const client = await dbPg.connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_xact_lock(1129271892, 101)")
    await client.query(`CREATE TABLE IF NOT EXISTS sankhya_correspondencias (
      modelo VARCHAR(200) NOT NULL,
      tecido VARCHAR(200) NOT NULL,
      cor VARCHAR(200) NOT NULL,
      destinos JSONB NOT NULL CHECK (jsonb_typeof(destinos) = 'array' AND jsonb_array_length(destinos) BETWEEN 1 AND 10),
      versao INTEGER NOT NULL DEFAULT 1 CHECK (versao > 0),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (modelo, tecido, cor)
    )`)
    await client.query("ALTER TABLE sankhya_correspondencias ENABLE ROW LEVEL SECURITY")
    await client.query("COMMIT")
  } catch (erro) {
    await client.query("ROLLBACK")
    throw erro
  } finally { client.release() }
}
