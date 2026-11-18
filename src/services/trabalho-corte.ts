import db from "../database-pg"
import { ErroRegra, executarNoCorte } from "./corte-bloqueado"
import { PoolClient } from "pg"
import { validarJustificativa, registrarAlteracaoAdmin } from "./historico-admin"

const normalizar=(v:string)=>v.trim().replace(/\s+/g," ").toUpperCase()
const campos=`id,numero_corte,mesa,operador,turno,status,iniciado_em,inicio_real_em,versao,
  TO_CHAR(data_trabalho,'YYYY-MM-DD') AS data,
  TO_CHAR(COALESCE(inicio_real_em,iniciado_em) AT TIME ZONE 'America/Sao_Paulo','HH24:MI') AS hora_inicio`

export async function conferirInicioReal(client:PoolClient,dados:any){
  const dia=dados?.data,hora=dados?.hora_inicio
  const d=typeof dia==="string"?new Date(`${dia}T00:00:00Z`):new Date(NaN)
  if(typeof dia!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(dia)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==dia||typeof hora!=="string"||!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora))throw new ErroRegra(400,"Informe uma data e uma hora de início válidas.")
  const r=await client.query(`SELECT ($1::date+$2::time) AT TIME ZONE 'America/Sao_Paulo' AS inicio,
    (($1::date+$2::time) AT TIME ZONE 'America/Sao_Paulo')<=CURRENT_TIMESTAMP AS permitido`,[dia,hora])
  if(!r.rows[0].permitido)throw new ErroRegra(400,"O início real não pode estar no futuro.")
  return r.rows[0].inicio
}

export async function assumirTrabalho(numero:number,dados:any){
  if(!dados||["operador","turno"].some(c=>typeof dados[c]!=="string"||!dados[c].trim()||dados[c].trim().length>200))throw new ErroRegra(400,"Informe operador e turno para assumir o trabalho.")
  return executarNoCorte(numero,async(client,corte)=>{
    const ultima=await client.query("SELECT status FROM producao WHERE numero_corte=$1 ORDER BY id DESC LIMIT 1",[numero])
    if(Number(corte.itens_finalizados)===1||ultima.rows[0]?.status==="FINALIZADO")throw new ErroRegra(409,"Este corte está finalizado. Selecione um corte em andamento.")
    const aberto=await client.query(`SELECT ${campos} FROM trabalhos_corte WHERE numero_corte=$1 AND status='EM_TRABALHO' ORDER BY iniciado_em,id LIMIT 1`,[numero])
    if(aberto.rows.length)return {trabalho:aberto.rows[0],novo:false}
    const inicioReal=dados.inicio_real?await conferirInicioReal(client,dados.inicio_real):null
    const operador=normalizar(dados.operador),turno=normalizar(dados.turno)
    const criado=await client.query(`INSERT INTO trabalhos_corte(numero_corte,mesa,operador,turno,inicio_real_em,data_trabalho)
      VALUES($1,$2,$3,$4,$5,COALESCE(($5::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date,(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date))
      RETURNING id`,[numero,corte.mesa,operador,turno,inicioReal])
    const consulta=await client.query(`SELECT ${campos} FROM trabalhos_corte WHERE id=$1`,[criado.rows[0].id])
    return {trabalho:consulta.rows[0],novo:true}
  })
}

export async function listarTrabalhos(numero:number){
  const r=await db.query(`SELECT ${campos},
    (SELECT id FROM producao WHERE numero_corte=$1 ORDER BY id DESC LIMIT 1) AS producao_base_id,
    COALESCE((SELECT folha_parou FROM producao WHERE numero_corte=$1 ORDER BY id DESC LIMIT 1),0) AS folha_inicio
    FROM trabalhos_corte WHERE numero_corte=$1 AND status='EM_TRABALHO' ORDER BY iniciado_em,id LIMIT 100`,[numero])
  return r.rows
}

export async function alterarTrabalho(numero:number,id:number,dados:any,cancelar=false){
  const justificativa=validarJustificativa(dados)
  if(!Number.isInteger(dados?.versao)||dados.versao<0)throw new ErroRegra(400,"Atualize o início antes de alterar.")
  if(!cancelar&&["operador","turno"].some(c=>typeof dados[c]!=="string"||!dados[c].trim()||dados[c].trim().length>200))throw new ErroRegra(400,"Informe operador e turno válidos.")
  return executarNoCorte(numero,async(client,corte)=>{
    const ultima=await client.query("SELECT status FROM producao WHERE numero_corte=$1 ORDER BY id DESC LIMIT 1",[numero])
    if(Number(corte.itens_finalizados)===1||ultima.rows[0]?.status==="FINALIZADO")throw new ErroRegra(409,"A produção deste corte já foi finalizada.")
    const anterior=(await client.query("SELECT * FROM trabalhos_corte WHERE numero_corte=$1 AND id=$2 FOR UPDATE",[numero,id])).rows[0]
    if(!anterior)throw new ErroRegra(404,"Início não encontrado neste corte.")
    if(anterior.status!=="EM_TRABALHO"||anterior.versao!==dados.versao)throw new ErroRegra(412,"Este início foi alterado, cancelado ou concluído. Atualize o corte antes de continuar.")
    const depois=cancelar
      ?(await client.query("UPDATE trabalhos_corte SET status='CANCELADO',versao=versao+1 WHERE id=$1 RETURNING *",[id])).rows[0]
      :(await client.query(`UPDATE trabalhos_corte SET operador=$1,turno=$2,inicio_real_em=$3,
        data_trabalho=$4::date,versao=versao+1 WHERE id=$5 RETURNING *`,
        [normalizar(dados.operador),normalizar(dados.turno),await conferirInicioReal(client,dados),dados.data,id])).rows[0]
    await registrarAlteracaoAdmin(client,{...justificativa,numero,registroId:id,
      acao:cancelar?"CANCELAMENTO_INICIO":"CORRECAO_INICIO",antes:anterior,depois})
    return {trabalho:(await client.query(`SELECT ${campos} FROM trabalhos_corte WHERE id=$1`,[id])).rows[0]}
  })
}

export async function prepararTrabalhosCorte(){
  const c=await db.connect()
  try{
    await c.query("BEGIN");await c.query("SELECT pg_advisory_xact_lock(1129271892,105)")
    await c.query(`CREATE TABLE IF NOT EXISTS trabalhos_corte(
      id BIGSERIAL PRIMARY KEY,numero_corte INTEGER NOT NULL REFERENCES cortes(numero) ON DELETE CASCADE,
      mesa TEXT NOT NULL,operador TEXT NOT NULL,turno TEXT NOT NULL,
      iniciado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      data_trabalho DATE NOT NULL DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date),
      status VARCHAR(20) NOT NULL DEFAULT 'EM_TRABALHO' CHECK(status IN('EM_TRABALHO','LANCADO')),
      producao_id BIGINT
    )`)
    await c.query("ALTER TABLE trabalhos_corte ADD COLUMN IF NOT EXISTS inicio_real_em TIMESTAMPTZ")
    await c.query("ALTER TABLE trabalhos_corte ADD COLUMN IF NOT EXISTS versao INTEGER NOT NULL DEFAULT 0")
    await c.query("ALTER TABLE trabalhos_corte DROP CONSTRAINT IF EXISTS trabalhos_corte_status_check")
    await c.query("ALTER TABLE trabalhos_corte ADD CONSTRAINT trabalhos_corte_status_check CHECK(status IN('EM_TRABALHO','LANCADO','CANCELADO'))")
    // A exclusividade é do trabalho pendente, conferido sob bloqueio do corte.
    // Registros concluídos não impedem o mesmo operador de assumir novamente.
    await c.query("ALTER TABLE trabalhos_corte DROP CONSTRAINT IF EXISTS trabalhos_corte_numero_corte_data_trabalho_turno_operador_key")
    await c.query("CREATE INDEX IF NOT EXISTS trabalhos_corte_pendentes_idx ON trabalhos_corte(numero_corte) WHERE status='EM_TRABALHO'")
    await c.query("ALTER TABLE trabalhos_corte ENABLE ROW LEVEL SECURITY")
    await c.query("COMMIT")
  }catch(e){await c.query("ROLLBACK");throw e}finally{c.release()}
}
