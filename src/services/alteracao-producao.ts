import { PoolClient } from "pg"
import dbPg from "../database-pg"
import { ErroRegra, executarNoCorte } from "./corte-bloqueado"
import { garantirMesaDisponivel } from "./mesa-disponivel"
import { Justificativa, registrarAlteracaoAdmin, validarJustificativa } from "./historico-admin"

// Editar ou excluir a última finalização pode fazer o corte ocupar a mesa novamente.
export async function executarAlteracaoProducao<T>(
  id: string, novoStatus: string | null, justificativa: Justificativa,
  operacao: (client: PoolClient) => Promise<T>
) {
  justificativa = validarJustificativa(justificativa)
  const registro = await dbPg.query<{ id: number; numero_corte: number }>(
    "SELECT id, numero_corte FROM producao WHERE id = $1", [id]
  )
  if (!registro.rows.length) throw new ErroRegra(404, "Lançamento de produção não encontrado")

  return executarNoCorte(registro.rows[0].numero_corte, async (client, corte) => {
    const anterior = await client.query("SELECT * FROM producao WHERE id = $1", [id])
    if (!anterior.rows.length) throw new ErroRegra(404, "Lançamento de produção não encontrado")
    // O bloqueio do corte serializa as correções com novos lançamentos de produção.
    const ultimas = await client.query<{ id: number; status: string }>(
      "SELECT id, status FROM producao WHERE numero_corte = $1 ORDER BY id DESC LIMIT 2",
      [corte.numero]
    )
    const ultima = ultimas.rows[0]
    const statusResultante = novoStatus ?? ultimas.rows[1]?.status ?? "EM PRODUÇÃO"
    const vaiReabrir = String(ultima?.id) === String(registro.rows[0].id) && ultima?.status === "FINALIZADO"
      && statusResultante !== "FINALIZADO"

    if (vaiReabrir) {
      await garantirMesaDisponivel(client, corte.mesa, corte.numero, "reabrir este corte")
    }

    const resultado = await operacao(client)
    const depois = novoStatus === null ? null : (await client.query("SELECT * FROM producao WHERE id = $1", [id])).rows[0]
    await registrarAlteracaoAdmin(client, {
      ...justificativa, numero: corte.numero, registroId: registro.rows[0].id,
      acao: novoStatus === null ? "EXCLUSAO_PRODUCAO" : vaiReabrir ? "REABERTURA_PRODUCAO" : "EDICAO_PRODUCAO",
      antes: anterior.rows[0], depois
    })
    return resultado
  })
}
