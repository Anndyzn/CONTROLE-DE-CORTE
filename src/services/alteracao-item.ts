import { PoolClient } from "pg"
import dbPg from "../database-pg"
import { ErroRegra, executarNoCorte } from "./corte-bloqueado"
import { Justificativa, registrarAlteracaoAdmin, validarJustificativa } from "./historico-admin"

export async function executarAlteracaoItem<T>(
  id: string, excluir: boolean, justificativa: Justificativa,
  operacao: (client: PoolClient) => Promise<T>
) {
  justificativa = validarJustificativa(justificativa)
  const registro = await dbPg.query("SELECT numero_corte FROM itens_corte WHERE id = $1", [id])
  if (!registro.rows.length) throw new ErroRegra(404, "Item não encontrado")
  return executarNoCorte(registro.rows[0].numero_corte, async (client, corte) => {
    const anterior = await client.query("SELECT * FROM itens_corte WHERE id = $1", [id])
    if (!anterior.rows.length) throw new ErroRegra(404, "Item não encontrado")
    const resultado = await operacao(client)
    const depois = excluir ? null : (await client.query("SELECT * FROM itens_corte WHERE id = $1", [id])).rows[0]
    await registrarAlteracaoAdmin(client, {
      ...justificativa, numero: corte.numero, registroId: id,
      acao: excluir ? "EXCLUSAO_PI" : "EDICAO_PI", antes: anterior.rows[0], depois
    })
    return resultado
  })
}
