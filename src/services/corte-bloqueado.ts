import { PoolClient } from "pg"
import dbPg from "../database-pg"

export class ErroRegra extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem)
  }
}

type Corte = { numero: number; itens_finalizados: number; mesa: string }

// Serializa lançamentos, correções e a confirmação dos PIs do mesmo corte.
export async function executarNoCorte<T>(
  numero: number,
  operacao: (client: PoolClient, corte: Corte) => Promise<T>
) {
  const client = await dbPg.connect()

  try {
    await client.query("BEGIN ISOLATION LEVEL READ COMMITTED")
    const resultado = await client.query<Corte>(
      "SELECT numero, itens_finalizados, mesa FROM cortes WHERE numero = $1 FOR UPDATE",
      [numero]
    )

    if (!resultado.rows.length) throw new ErroRegra(404, "Corte não encontrado.")

    const valor = await operacao(client, resultado.rows[0])
    await client.query("COMMIT")
    return valor
  } catch (erro) {
    await client.query("ROLLBACK")
    throw erro
  } finally {
    client.release()
  }
}
