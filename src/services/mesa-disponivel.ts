import dbPg from "../database-pg"
import { PoolClient } from "pg"
import { ErroRegra } from "./corte-bloqueado"

export const MESAS = ["MESA 1", "MESA 2", "MESA 3"]

export function normalizarMesa(mesa: unknown) {
  return typeof mesa === "string" ? mesa.trim().replace(/\s+/g, " ").toUpperCase() : ""
}

type Ocupante = { numero: number; produto: string }

export class ErroMesaOcupada extends ErroRegra {
  constructor(public mesa: string, public cortes: Ocupante[], acao = "cadastrar outro nesta mesa") {
    const referencia = cortes.length === 1
      ? `pelo corte ${cortes[0].numero}`
      : `pelos cortes ${cortes.map(corte => corte.numero).join(", ")}`
    const instrucao = cortes.length === 1 ? "Finalize esse corte" : "Finalize esses cortes"
    super(409, `A ${mesa} está ocupada ${referencia}. ${instrucao} antes de ${acao}.`)
  }
}

// Deve ser executada em uma transação: cadastros e reaberturas usam o mesmo bloqueio.
export async function garantirMesaDisponivel(
  client: PoolClient, mesa: string, numeroIgnorado: number | null = null,
  acao = "cadastrar outro nesta mesa"
) {
  mesa = normalizarMesa(mesa)
  // CORT identifica as reservas de mesa, inclusive entre instâncias do servidor.
  await client.query("SELECT pg_advisory_xact_lock($1::integer, $2::integer)", [
    0x434f5254, MESAS.indexOf(mesa) + 1
  ])

  // A consulta após o bloqueio enxerga o cadastro ou a reabertura que acabou de concluir.
  const ocupantes = await client.query<Ocupante>(
    `
    SELECT c.numero, c.produto
    FROM cortes c
    LEFT JOIN LATERAL (
      SELECT p2.status
      FROM producao p2
      WHERE p2.numero_corte = c.numero
      ORDER BY p2.id DESC
      LIMIT 1
    ) p ON TRUE
    WHERE UPPER(BTRIM(REGEXP_REPLACE(c.mesa, '[[:space:]]+', ' ', 'g'))) = $1
      AND ($2::integer IS NULL OR c.numero <> $2)
      AND COALESCE(p.status, 'EM PRODUÇÃO') <> 'FINALIZADO'
    ORDER BY c.numero DESC
    `,
    [mesa, numeroIgnorado]
  )

  if (ocupantes.rows.length) throw new ErroMesaOcupada(mesa, ocupantes.rows, acao)
}

export async function cadastrarCorteNaMesa(numero: number, produto: string, mesa: string) {
  const client = await dbPg.connect()

  try {
    await client.query("BEGIN ISOLATION LEVEL READ COMMITTED")
    await garantirMesaDisponivel(client, mesa)

    const resultado = await client.query(
      "INSERT INTO cortes (numero, produto, mesa) VALUES ($1, $2, $3) RETURNING *",
      [numero, produto, mesa]
    )

    await client.query("COMMIT")
    return resultado.rows[0]
  } catch (erro) {
    await client.query("ROLLBACK")
    throw erro
  } finally {
    client.release()
  }
}
