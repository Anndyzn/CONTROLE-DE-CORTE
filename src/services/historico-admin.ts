import { PoolClient } from "pg"
import dbPg from "../database-pg"
import { ErroRegra } from "./corte-bloqueado"

export type Justificativa = { responsavel: string; motivo: string }

export function validarJustificativa(dados: unknown): Justificativa {
  const valor = dados as Partial<Justificativa> | null
  const responsavel = typeof valor?.responsavel === "string" ? valor.responsavel.trim() : ""
  const motivo = typeof valor?.motivo === "string" ? valor.motivo.trim() : ""
  if (responsavel.length < 2 || responsavel.length > 100) {
    throw new ErroRegra(400, "Informe o responsável pela alteração (2 a 100 caracteres).")
  }
  if (motivo.length < 3 || motivo.length > 1000) {
    throw new ErroRegra(400, "Informe o motivo da alteração (3 a 1000 caracteres).")
  }
  return { responsavel, motivo }
}

// Não há chave estrangeira para cortes: o histórico deve sobreviver à exclusão deles.
export async function prepararHistoricoAdmin() {
  const client = await dbPg.connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_xact_lock(1129271892, 100)")
    await client.query(`
      CREATE TABLE IF NOT EXISTS historico_admin (
        id BIGSERIAL PRIMARY KEY,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        numero_corte INTEGER NOT NULL,
        acao TEXT NOT NULL,
        registro_id BIGINT,
        responsavel VARCHAR(100) NOT NULL,
        motivo VARCHAR(1000) NOT NULL,
        antes JSONB,
        depois JSONB
      )
    `)
    await client.query("CREATE INDEX IF NOT EXISTS historico_admin_corte_id ON historico_admin (numero_corte, id DESC)")
    // A consulta é feita pelo servidor; não há acesso direto pelo cliente Supabase.
    await client.query("ALTER TABLE historico_admin ENABLE ROW LEVEL SECURITY")
    await client.query("COMMIT")
  } catch (erro) {
    await client.query("ROLLBACK")
    throw erro
  } finally {
    client.release()
  }
}

export async function registrarAlteracaoAdmin(
  client: PoolClient,
  dados: Justificativa & { numero: number; acao: string; registroId?: number | string; antes: unknown; depois: unknown }
) {
  await client.query(
    `INSERT INTO historico_admin (numero_corte, acao, registro_id, responsavel, motivo, antes, depois)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
    [dados.numero, dados.acao, dados.registroId ?? null, dados.responsavel, dados.motivo,
      JSON.stringify(dados.antes), JSON.stringify(dados.depois)]
  )
}
