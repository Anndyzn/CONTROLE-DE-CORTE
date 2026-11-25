import db from "../database-pg"
import { ErroRegra } from "./corte-bloqueado"

export const defeitosPermitidos = ["Sujo", "Manchado", "Rasgado", "Molhado", "Outro"]

function texto(valor: unknown, nome: string, max: number, obrigatorio = false) {
  if (typeof valor !== "string" || valor.trim().length > max || (obrigatorio && !valor.trim())) {
    throw new ErroRegra(400, `Informe ${nome}${obrigatorio ? "" : " ou deixe vazio"} (até ${max} caracteres).`)
  }
  return valor.trim()
}

export function validarTecido(dados: any) {
  const nf = texto(dados?.nf, "a NF", 80, true)
  const tecido = texto(dados?.tecido, "o tecido", 200, true).replace(/\s+/g, " ").toUpperCase()
  const cor = texto(dados?.cor ?? "", "a cor", 100).replace(/\s+/g, " ").toUpperCase()
  const observacao = texto(dados?.observacao ?? "", "a observação", 1000)
  const bruto = typeof dados?.metros === "number" ? String(dados.metros) : dados?.metros
  if (typeof bruto !== "string" || !/^\d{1,9}([.,]\d{1,3})?$/.test(bruto.trim())) {
    throw new ErroRegra(400, "Informe a metragem com até três casas decimais.")
  }
  const metros = Number(bruto.trim().replace(",", "."))
  if (!Number.isFinite(metros) || metros <= 0 || metros > 999999999.999) throw new ErroRegra(400, "A metragem deve ser maior que zero.")
  if (!Array.isArray(dados?.defeitos) || !dados.defeitos.length || dados.defeitos.some((d: any) => !defeitosPermitidos.includes(d))) {
    throw new ErroRegra(400, "Selecione pelo menos um defeito válido.")
  }
  const defeitos = defeitosPermitidos.filter(d => dados.defeitos.includes(d))
  if (defeitos.includes("Outro") && !observacao) throw new ErroRegra(400, "Descreva o defeito na observação ao selecionar Outro.")
  return { nf, tecido, cor, metros, defeitos, observacao }
}

export async function prepararTecidosDefeitos() {
  const c = await db.connect()
  try {
    await c.query("BEGIN")
    await c.query("SELECT pg_advisory_xact_lock(1129271892,106)")
    await c.query(`CREATE TABLE IF NOT EXISTS tecidos_defeitos (
      id BIGSERIAL PRIMARY KEY, chave_envio UUID NOT NULL UNIQUE,
      nf TEXT NOT NULL, tecido TEXT NOT NULL, cor TEXT NOT NULL DEFAULT '',
      metros NUMERIC(12,3) NOT NULL CHECK(metros>0),
      defeitos TEXT[] NOT NULL CHECK(cardinality(defeitos)>0 AND defeitos <@ ARRAY['Sujo','Manchado','Rasgado','Molhado','Outro']::text[]),
      observacao TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK(status IN ('PENDENTE','RESOLVIDO')),
      criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolvido_em TIMESTAMPTZ, resolucao TEXT NOT NULL DEFAULT '', versao INTEGER NOT NULL DEFAULT 0
    )`)
    await c.query(`CREATE TABLE IF NOT EXISTS tecidos_defeitos_eventos (
      id BIGSERIAL PRIMARY KEY, tecido_defeito_id BIGINT NOT NULL REFERENCES tecidos_defeitos(id),
      status TEXT NOT NULL CHECK(status IN ('PENDENTE','RESOLVIDO')),
      observacao TEXT NOT NULL DEFAULT '', criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    await c.query("CREATE INDEX IF NOT EXISTS tecidos_defeitos_status_idx ON tecidos_defeitos(status,id DESC)")
    await c.query("ALTER TABLE tecidos_defeitos ENABLE ROW LEVEL SECURITY")
    await c.query("ALTER TABLE tecidos_defeitos_eventos ENABLE ROW LEVEL SECURITY")
    await c.query("COMMIT")
  } catch (e) { await c.query("ROLLBACK"); throw e }
  finally { c.release() }
}

export async function cadastrarTecido(dados: any) {
  const item = validarTecido(dados)
  if (typeof dados?.chave_envio !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(dados.chave_envio)) {
    throw new ErroRegra(400, "Identificação de envio inválida. Recarregue a página.")
  }
  const valores = [dados.chave_envio, item.nf, item.tecido, item.cor, item.metros, item.defeitos, item.observacao]
  const r = await db.query(`INSERT INTO tecidos_defeitos(chave_envio,nf,tecido,cor,metros,defeitos,observacao)
    VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(chave_envio) DO NOTHING RETURNING *`, valores)
  if (r.rows.length) return r.rows[0]
  const anterior = (await db.query("SELECT * FROM tecidos_defeitos WHERE chave_envio=$1", [dados.chave_envio])).rows[0]
  if (!anterior || anterior.nf !== item.nf || anterior.tecido !== item.tecido || anterior.cor !== item.cor ||
    Number(anterior.metros) !== item.metros || anterior.observacao !== item.observacao || JSON.stringify(anterior.defeitos) !== JSON.stringify(item.defeitos)) {
    throw new ErroRegra(409, "Este envio já foi usado com outros dados. Atualize a lista antes de cadastrar novamente.")
  }
  return anterior
}

export function filtroTecidos(status: unknown, busca: unknown) {
  if (status !== "PENDENTE" && status !== "RESOLVIDO") throw new ErroRegra(400, "Escolha pendentes ou resolvidos.")
  if (typeof busca !== "string" || busca.length > 200) throw new ErroRegra(400, "Busca inválida (até 200 caracteres).")
  return [status, busca.trim()]
}

const condicao = "status=$1 AND ($2='' OR strpos(lower(nf||' '||tecido||' '||cor),lower($2))>0)"

export async function listarTecidos(status: unknown, busca: unknown, pagina: number, imprimir = false) {
  const valores = filtroTecidos(status, busca)
  if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 1000000) throw new ErroRegra(400, "Página inválida.")
  const c = await db.connect()
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
    const resumo = (await c.query(`SELECT COUNT(*)::integer AS quantidade,COALESCE(SUM(metros),0)::text AS metros FROM tecidos_defeitos WHERE ${condicao}`, valores)).rows[0]
    if (imprimir && resumo.quantidade > 5000) throw new ErroRegra(400, "Refine a busca para imprimir até 5.000 peças por vez.")
    const r = await c.query(`SELECT id,nf,tecido,cor,metros,defeitos,observacao,status,criado_em,resolvido_em,resolucao,versao
      FROM tecidos_defeitos WHERE ${condicao} ORDER BY nf COLLATE "C",id LIMIT $3 OFFSET $4`, [...valores, imprimir ? 5000 : 50, imprimir ? 0 : (pagina - 1) * 50])
    await c.query("COMMIT")
    return { itens: r.rows, resumo, pagina, por_pagina: 50 }
  } catch (e) { await c.query("ROLLBACK"); throw e }
  finally { c.release() }
}

export async function alterarSituacaoTecido(id: number, dados: any) {
  if (!Number.isSafeInteger(id) || id < 1) throw new ErroRegra(400, "Registro inválido.")
  if (!Number.isSafeInteger(dados?.versao) || dados.versao < 0) throw new ErroRegra(400, "Atualize a lista antes de alterar.")
  if (!["PENDENTE", "RESOLVIDO"].includes(dados?.status)) throw new ErroRegra(400, "Situação inválida.")
  const observacao = texto(dados?.observacao ?? "", "a observação do atendimento", 1000)
  const c = await db.connect()
  try {
    await c.query("BEGIN")
    const anterior = (await c.query("SELECT * FROM tecidos_defeitos WHERE id=$1 FOR UPDATE", [id])).rows[0]
    if (!anterior) throw new ErroRegra(404, "Peça não encontrada.")
    if (anterior.versao !== dados.versao || anterior.status === dados.status) throw new ErroRegra(412, "Esta peça já foi alterada. Atualize a lista.")
    const r = await c.query(`UPDATE tecidos_defeitos SET status=$2,versao=versao+1,
      resolvido_em=CASE WHEN $2='RESOLVIDO' THEN CURRENT_TIMESTAMP ELSE NULL END,
      resolucao=CASE WHEN $2='RESOLVIDO' THEN $3 ELSE '' END WHERE id=$1 RETURNING *`, [id, dados.status, observacao])
    await c.query("INSERT INTO tecidos_defeitos_eventos(tecido_defeito_id,status,observacao) VALUES($1,$2,$3)", [id, dados.status, observacao])
    await c.query("COMMIT")
    return r.rows[0]
  } catch (e) { await c.query("ROLLBACK"); throw e }
  finally { c.release() }
}

export async function sugerirTecidos() {
  return (await db.query(`SELECT tecido FROM (
    SELECT upper(trim(tecido)) AS tecido FROM itens_corte WHERE tecido IS NOT NULL
    UNION SELECT tecido FROM tecidos_defeitos
  ) nomes WHERE tecido<>'' ORDER BY tecido LIMIT 500`)).rows.map(r => r.tecido)
}
