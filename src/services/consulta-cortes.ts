import { ErroRegra } from "./corte-bloqueado"

export function montarConsultaCortes(filtros: Record<string, unknown>) {
  let query = `
    SELECT c.numero, c.produto, c.mesa, c.itens_finalizados, p.data, p.status, p.folha_parou
    FROM cortes c
    LEFT JOIN LATERAL (
      SELECT p2.data, p2.status, p2.folha_parou
      FROM producao p2 WHERE p2.numero_corte = c.numero
      ORDER BY p2.id DESC LIMIT 1
    ) p ON TRUE
    WHERE 1 = 1
  `
  const params: string[] = []
  const aplicados: Record<string, string> = {}
  for (const nome of ["numero", "produto", "data_inicial", "data_final", "status"]) {
    const valor = filtros[nome]
    if (valor === undefined || valor === "") continue
    if (typeof valor !== "string") throw new ErroRegra(400, "Informe filtros válidos para a consulta.")
    aplicados[nome] = valor.trim()
  }
  if (aplicados.numero && (!/^\d+$/.test(aplicados.numero) || Number(aplicados.numero) < 1 || Number(aplicados.numero) > 2147483647)) {
    throw new ErroRegra(400, "Informe um número de corte válido.")
  }
  for (const nome of ["data_inicial", "data_final"]) {
    const data = aplicados[nome]
    if (data && (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isFinite(Date.parse(data)) || new Date(data).toISOString().slice(0, 10) !== data)) {
      throw new ErroRegra(400, "Informe datas válidas para a consulta.")
    }
  }
  if (aplicados.data_inicial && aplicados.data_final && aplicados.data_inicial > aplicados.data_final) {
    throw new ErroRegra(400, "A data final não pode ser anterior à data inicial.")
  }
  if (aplicados.status && !["EM PRODUÇÃO", "FINALIZADO"].includes(aplicados.status)) {
    throw new ErroRegra(400, "Selecione um status válido.")
  }
  const condicoes: Record<string, string> = {
    numero: "c.numero =", produto: "UPPER(c.produto) LIKE UPPER(",
    data_inicial: "p.data >=", data_final: "p.data <=", status: "p.status ="
  }
  for (const [nome, condicao] of Object.entries(condicoes)) {
    if (!aplicados[nome]) continue
    params.push(nome === "produto" ? `%${aplicados[nome]}%` : aplicados[nome])
    query += ` AND ${condicao} $${params.length}${nome === "produto" ? ")" : ""}`
  }
  query += " ORDER BY c.numero DESC"
  return { query, params, filtros: aplicados }
}
