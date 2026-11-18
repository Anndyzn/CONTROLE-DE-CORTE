import { createHash } from "crypto"
import { PoolClient } from "pg"

export class ErroProducaoSemelhante extends Error {
  constructor(public registros: any[], public confirmacao: string) {
    super("Já existe produção para este corte, data, turno e operador. Confira antes de registrar outro lançamento.")
  }
}

export async function conferirDuplicidadeProducao(client: PoolClient, dados: any, confirmacao?: unknown) {
  const resultado=await client.query(`SELECT id, TO_CHAR(data,'YYYY-MM-DD') AS data, turno, operador,
    hora_inicio,hora_fim,folha_inicio,folha_parou,status FROM producao
    WHERE numero_corte=$1 AND data=$2
    AND UPPER(REGEXP_REPLACE(TRIM(turno),'\\s+',' ','g'))=$3
    AND UPPER(REGEXP_REPLACE(TRIM(operador),'\\s+',' ','g'))=$4
    ORDER BY id DESC LIMIT 10`,[
    Number(dados.numero_corte),dados.data,
    dados.turno.trim().replace(/\s+/g," ").toUpperCase(),dados.operador.trim().replace(/\s+/g," ").toUpperCase()
  ])
  if(!resultado.rows.length)return
  // A confirmação só vale para estes dados e para os registros que a pessoa conferiu.
  const token=createHash("sha256").update(JSON.stringify([
    dados.data,Number(dados.numero_corte),dados.turno,dados.operador,
    Number(dados.folha_inicio),Number(dados.folha_parou),dados.hora_inicio??null,dados.hora_fim??null,dados.status,
    resultado.rows
  ])).digest("hex")
  if(confirmacao!==token)throw new ErroProducaoSemelhante(resultado.rows,token)
}
