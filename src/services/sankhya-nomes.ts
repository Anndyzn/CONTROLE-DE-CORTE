import db from "../database-pg"
import { ErroRegra } from "./corte-bloqueado"
import { obterCatalogoSankhya } from "./sankhya-catalogo"
import { normalizarNome } from "./sankhya-preparacao"

export function validarOpcoesNome(valor: any) {
  if (!valor || typeof valor.nome !== "string" || !valor.nome.trim() || valor.nome.length > 200 || !Number.isSafeInteger(valor.versao) || valor.versao < 0) throw new ErroRegra(400, "Selecione a nomenclatura e recarregue antes de salvar.")
  if (!Array.isArray(valor.opcoes) || valor.opcoes.length > 30) throw new ErroRegra(400, "Cadastre no máximo 30 opções.")
  const catalogo = obterCatalogoSankhya(), vistas = new Set<string>()
  const opcoes = valor.opcoes.map((opcao: any) => {
    if (!opcao || !Array.isArray(opcao.codigos) || !opcao.codigos.length || opcao.codigos.length > 10) throw new ErroRegra(400, "Escolha de 1 a 10 produtos por opção.")
    const codigos: number[] = opcao.codigos
    if (codigos.some(c => !Number.isSafeInteger(c) || !catalogo.produtos.some(p => p.codigo_produto === c)) || new Set(codigos).size !== codigos.length) throw new ErroRegra(400, "Escolha produtos válidos e sem repetição na opção.")
    const chave = [...codigos].sort((a,b) => a-b).join(",")
    if (vistas.has(chave)) throw new ErroRegra(400, "Remova as opções repetidas.")
    vistas.add(chave)
    return {codigos, rotulo: codigos.map(c => `${c} — ${catalogo.produtos.find(p => p.codigo_produto === c)!.produto}`).join(" + ")}
  })
  return {nome: normalizarNome(valor.nome), versao: valor.versao as number, opcoes}
}

export async function prepararNomesSankhya() {
  const client = await db.connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_xact_lock(1129271892, 102)")
    await client.query(`CREATE TABLE IF NOT EXISTS sankhya_nomes (
      nome VARCHAR(200) PRIMARY KEY, opcoes JSONB NOT NULL CHECK (jsonb_typeof(opcoes) = 'array'),
      versao INTEGER NOT NULL DEFAULT 1 CHECK (versao > 0), atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    await client.query("ALTER TABLE sankhya_nomes ENABLE ROW LEVEL SECURITY")
    await client.query("COMMIT")
  } catch (erro) { await client.query("ROLLBACK"); throw erro }
  finally { client.release() }
}
