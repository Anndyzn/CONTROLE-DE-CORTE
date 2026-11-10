import { Router } from "express"
import { createHash } from "crypto"
import db from "../database-pg"
import { ErroRegra } from "../services/corte-bloqueado"
import { obterCatalogoSankhya } from "../services/sankhya-catalogo"
import { numeroCorteValido } from "../utils/validacoes"
const router = Router()
export const assinaturaItem = (item: any) => createHash("sha256").update(JSON.stringify([item.modelo,item.cor,item.tecido,String(item.quantidade_pecas),String(item.metragem_usada)])).digest("hex")
function erro(res: import("express").Response, e: unknown) {
  if(e instanceof ErroRegra)return res.status(e.status).json({erro:e.message})
  console.error("Falha no controle de lançamentos Sankhya:",e)
  return res.status(500).json({erro:"Não foi possível salvar ou consultar as marcações. Consulte o corte novamente."})
}
export function validarLancamento(v: any) {
  if(!v || !Number.isSafeInteger(v.versao) || v.versao<0 || typeof v.assinatura!=="string" || !/^[a-f0-9]{64}$/.test(v.assinatura))throw new ErroRegra(400,"Recarregue o corte antes de marcar.")
  const catalogo=obterCatalogoSankhya()
  for(const campo of ["codigos","lancados"]){
    if(!Array.isArray(v[campo]) || v[campo].length>30 || new Set(v[campo]).size!==v[campo].length || v[campo].some((c:unknown)=>!Number.isSafeInteger(c)||!catalogo.produtos.some(p=>p.codigo_produto===c)))throw new ErroRegra(400,"Produtos inválidos ou repetidos.")
  }
  if(v.lancados.some((c:number)=>!v.codigos.includes(c)))throw new ErroRegra(400,"Um produto lançado deve permanecer selecionado.")
  return {codigos:v.codigos as number[],lancados:v.lancados as number[],versao:v.versao as number,assinatura:v.assinatura as string}
}
router.post("/sankhya/itens/:id/replicar",async(req,res)=>{
 if(!numeroCorteValido(req.params.id))return res.status(400).json({erro:"PI inválido."})
 let c
 try{
  const v=validarLancamento({...req.body,lancados:[]})
  if(!v.codigos.length)throw new ErroRegra(400,"Selecione os produtos antes de aplicar às outras cores.")
  const normalizar=(s:string)=>s.trim().replace(/\s+/g," ").toUpperCase()
  c=await db.connect();await c.query("BEGIN")
  const inicial=await c.query("SELECT numero_corte FROM itens_corte WHERE id=$1",[Number(req.params.id)])
  if(!inicial.rows.length)throw new ErroRegra(404,"PI não encontrado.")
  const todos=await c.query("SELECT i.* FROM itens_corte i WHERE i.numero_corte=$1 ORDER BY i.id FOR UPDATE",[inicial.rows[0].numero_corte])
  const origem=todos.rows.find(i=>Number(i.id)===Number(req.params.id))
  if(!origem||assinaturaItem(origem)!==v.assinatura)throw new ErroRegra(409,"O PI foi alterado. Consulte o corte novamente.")
  const estados=await c.query("SELECT item_id,versao FROM sankhya_lancamentos WHERE item_id=ANY($1::integer[]) FOR UPDATE",[todos.rows.map(i=>i.id)])
  const estadoOrigem=estados.rows.find(e=>Number(e.item_id)===Number(origem.id))
  if(Number(estadoOrigem?.versao??0)!==v.versao)throw new ErroRegra(409,"Os vínculos foram alterados em outra tela. Consulte o corte novamente.")
  const existentes=await c.query("SELECT modelo,tecido,cor FROM sankhya_correspondencias WHERE modelo=$1",[normalizar(origem.modelo)])
  let aplicados=0,preservados=0
  for(const i of todos.rows){
   if(Number(i.id)===Number(origem.id)||normalizar(i.modelo)!==normalizar(origem.modelo)||normalizar(i.tecido)!==normalizar(origem.tecido)||normalizar(i.cor)===normalizar(origem.cor))continue
   if(estados.rows.some(e=>Number(e.item_id)===Number(i.id))||existentes.rows.some(e=>normalizar(e.tecido)===normalizar(i.tecido)&&normalizar(e.cor)===normalizar(i.cor))){preservados++;continue}
   const r=await c.query(`INSERT INTO sankhya_lancamentos(item_id,codigos,lancados,assinatura) VALUES($1,$2::jsonb,'[]'::jsonb,$3) ON CONFLICT DO NOTHING RETURNING item_id`,[i.id,JSON.stringify(v.codigos),assinaturaItem(i)])
   if(r.rows.length)aplicados++;else preservados++
  }
  await c.query("COMMIT");res.json({aplicados,preservados})
 }catch(e){if(c)await c.query("ROLLBACK");erro(res,e)}finally{c?.release()}
})
router.get("/sankhya/cortes/:numero/lancamentos",async(req,res)=>{
  if(!numeroCorteValido(req.params.numero))return res.status(400).json({erro:"Corte inválido."})
  try {
    const r=await db.query(`SELECT i.id, i.modelo, i.cor, i.tecido, i.quantidade_pecas, i.metragem_usada,
      l.codigos, l.lancados, l.assinatura AS anterior, COALESCE(l.versao,0) AS versao
      FROM itens_corte i LEFT JOIN sankhya_lancamentos l ON l.item_id=i.id WHERE i.numero_corte=$1 ORDER BY i.id`,[Number(req.params.numero)])
    res.setHeader("Cache-Control","no-store")
    res.json({itens:r.rows.map(i=>{const assinatura=assinaturaItem(i),atual=i.anterior===assinatura;return {id:i.id,assinatura,versao:i.versao,origem:[i.modelo,i.cor,i.tecido,String(i.quantidade_pecas),String(i.metragem_usada)],codigos:atual?i.codigos:null,lancados:atual?i.lancados:[],revisar:!!i.anterior&&!atual}})})
  }catch(e){erro(res,e)}
})
router.put("/sankhya/itens/:id/lancamento",async(req,res)=>{
  if(!numeroCorteValido(req.params.id))return res.status(400).json({erro:"PI inválido."})
  let client
  try {
    const v=validarLancamento(req.body)
    client=await db.connect();await client.query("BEGIN")
    const r=await client.query("SELECT id, modelo, cor, tecido, quantidade_pecas, metragem_usada FROM itens_corte WHERE id=$1 FOR SHARE",[Number(req.params.id)])
    if(!r.rows.length)throw new ErroRegra(404,"PI não encontrado.")
    if(assinaturaItem(r.rows[0])!==v.assinatura)throw new ErroRegra(409,"O PI foi alterado. Consulte o corte novamente antes de marcar.")
    const valores=[Number(req.params.id),JSON.stringify(v.codigos),JSON.stringify(v.lancados),v.assinatura]
    const salvo=v.versao===0
      ?await client.query(`INSERT INTO sankhya_lancamentos (item_id,codigos,lancados,assinatura) VALUES ($1,$2::jsonb,$3::jsonb,$4) ON CONFLICT DO NOTHING RETURNING versao`,valores)
      :await client.query(`UPDATE sankhya_lancamentos SET codigos=$2::jsonb,lancados=$3::jsonb,assinatura=$4,versao=versao+1,atualizado_em=NOW() WHERE item_id=$1 AND versao=$5 RETURNING versao`,[...valores,v.versao])
    if(!salvo.rows.length)throw new ErroRegra(409,"As marcações foram alteradas em outra tela. Consulte o corte novamente.")
    await client.query("COMMIT");res.json({versao:salvo.rows[0].versao})
  }catch(e){if(client)await client.query("ROLLBACK");erro(res,e)}finally{client?.release()}
})
export async function prepararLancamentosSankhya(){
  const c=await db.connect()
  try{
    await c.query("BEGIN");await c.query("SELECT pg_advisory_xact_lock(1129271892,103)")
    await c.query(`CREATE TABLE IF NOT EXISTS sankhya_lancamentos (
      item_id INTEGER PRIMARY KEY REFERENCES itens_corte(id) ON DELETE CASCADE,
      codigos JSONB NOT NULL CHECK(jsonb_typeof(codigos)='array'), lancados JSONB NOT NULL CHECK(jsonb_typeof(lancados)='array'),
      assinatura VARCHAR(64) NOT NULL,versao INTEGER NOT NULL DEFAULT 1 CHECK(versao>0),atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    await c.query("ALTER TABLE sankhya_lancamentos ENABLE ROW LEVEL SECURITY");await c.query("COMMIT")
  }catch(e){await c.query("ROLLBACK");throw e}finally{c.release()}
}
export default router
