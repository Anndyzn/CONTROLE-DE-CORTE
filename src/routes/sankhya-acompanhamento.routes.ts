import { Router } from "express"
import db from "../database-pg"
import { assinaturaItem } from "./sankhya-lancamentos.routes"
import { obterCatalogoSankhya } from "../services/sankhya-catalogo"
const router=Router()
const normalizar=(v:string)=>v.trim().replace(/\s+/g," ").toUpperCase()
export function resumirAcompanhamento(linhas:any[]){
 const cortes=new Map<number,any>(),catalogo=obterCatalogoSankhya()
 for(const l of linhas){
  if(!cortes.has(l.numero))cortes.set(l.numero,{numero:l.numero,produto:l.produto,status:l.status,itens_finalizados:l.itens_finalizados,total:0,lancados:0,sem_vinculo:false,nome_sem_vinculo:!l.opcoes?.length,escolher:false,itens:0})
  const c=cortes.get(l.numero)
  if(l.id==null){c.sem_vinculo=!l.opcoes?.length;continue}
  c.itens++
  const atual=l.assinatura===assinaturaItem(l)
  const destinos=l.destinos??[]
  const opcoes=l.opcoes??[]
  const codigos=atual&&Array.isArray(l.codigos)?l.codigos:destinos.length?destinos.map((d:any)=>d.codigo_produto):opcoes.length===1?opcoes[0].codigos:[]
  const validos=[...new Set(codigos)].filter(codigo=>catalogo.produtos.some(p=>p.codigo_produto===codigo))
  if(validos.length!==new Set(codigos).size)c.escolher=true
  if(!validos.length){if(!opcoes.length&&!destinos.length)c.sem_vinculo=true;else c.escolher=true}
  c.total+=validos.length
  c.lancados+=validos.filter(codigo=>atual&&l.lancados?.includes(codigo)).length
 }
 return [...cortes.values()].map(c=>({...c,situacao:c.status!=="FINALIZADO"||Number(c.itens_finalizados)!==1?"EM_ANDAMENTO":c.sem_vinculo?"SEM_VINCULO":c.escolher||!c.itens||!c.total?"ESCOLHER":c.lancados===c.total?"LANCADO":"PENDENTE"}))
}
router.get("/sankhya/acompanhamento",async(_req,res)=>{
 try{
  const r=await db.query(`SELECT c.numero,c.produto,c.itens_finalizados,p.status,i.id,i.modelo,i.cor,i.tecido,i.quantidade_pecas,i.metragem_usada,
    l.codigos,l.lancados,l.assinatura,n.opcoes,v.destinos
    FROM sankhya_acompanhamento a JOIN cortes c ON c.numero=a.numero
    LEFT JOIN LATERAL (SELECT status FROM producao WHERE numero_corte=c.numero ORDER BY id DESC LIMIT 1) p ON TRUE
    LEFT JOIN itens_corte i ON i.numero_corte=c.numero
    LEFT JOIN sankhya_lancamentos l ON l.item_id=i.id
    LEFT JOIN sankhya_nomes n ON n.nome=UPPER(REGEXP_REPLACE(TRIM(c.produto),'\\s+',' ','g'))
    LEFT JOIN sankhya_correspondencias v ON v.modelo=UPPER(REGEXP_REPLACE(TRIM(i.modelo),'\\s+',' ','g'))
      AND v.cor=UPPER(REGEXP_REPLACE(TRIM(i.cor),'\\s+',' ','g')) AND v.tecido=UPPER(REGEXP_REPLACE(TRIM(i.tecido),'\\s+',' ','g'))
    ORDER BY a.incluido_em DESC,c.numero DESC,i.id`)
  const cortes=resumirAcompanhamento(r.rows)
  const faltantes=new Map<string,any>()
  for(const c of cortes)if(c.nome_sem_vinculo){const nome=normalizar(c.produto);if(!faltantes.has(nome))faltantes.set(nome,{nome,cortes:[]});faltantes.get(nome).cortes.push(c.numero)}
  res.setHeader("Cache-Control","no-store");res.json({cortes,faltantes:[...faltantes.values()]})
 }catch(e){console.error("Falha no acompanhamento Sankhya:",e);res.status(500).json({erro:"Não foi possível consultar as pendências. Tente atualizar."})}
})
export async function prepararAcompanhamentoSankhya(){
 const c=await db.connect()
 try{
  await c.query("BEGIN");await c.query("SELECT pg_advisory_xact_lock(1129271892,104)")
  await c.query("LOCK TABLE cortes IN SHARE ROW EXCLUSIVE MODE")
  await c.query(`CREATE TABLE IF NOT EXISTS sankhya_acompanhamento (numero INTEGER PRIMARY KEY REFERENCES cortes(numero) ON DELETE CASCADE,incluido_em TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
  await c.query(`CREATE TABLE IF NOT EXISTS sankhya_acompanhamento_inicio (id INTEGER PRIMARY KEY CHECK(id=1),iniciado_em TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
  await c.query(`INSERT INTO sankhya_acompanhamento(numero) SELECT c.numero FROM cortes c
    LEFT JOIN LATERAL (SELECT status FROM producao WHERE numero_corte=c.numero ORDER BY id DESC LIMIT 1) p ON TRUE
    WHERE COALESCE(p.status,'')<>'FINALIZADO' AND NOT EXISTS(SELECT 1 FROM sankhya_acompanhamento_inicio)
    ON CONFLICT DO NOTHING`)
  await c.query("INSERT INTO sankhya_acompanhamento_inicio(id) VALUES(1) ON CONFLICT DO NOTHING")
  await c.query(`CREATE OR REPLACE FUNCTION public.acompanhar_novo_corte_sankhya() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    INSERT INTO public.sankhya_acompanhamento(numero) VALUES(NEW.numero) ON CONFLICT DO NOTHING; RETURN NEW; END; $$`)
  await c.query("DROP TRIGGER IF EXISTS acompanhar_sankhya ON cortes")
  await c.query("CREATE TRIGGER acompanhar_sankhya AFTER INSERT ON cortes FOR EACH ROW EXECUTE FUNCTION public.acompanhar_novo_corte_sankhya()")
  await c.query("ALTER TABLE sankhya_acompanhamento ENABLE ROW LEVEL SECURITY")
  await c.query("ALTER TABLE sankhya_acompanhamento_inicio ENABLE ROW LEVEL SECURITY")
  await c.query("COMMIT")
 }catch(e){await c.query("ROLLBACK");throw e}finally{c.release()}
}
export default router
