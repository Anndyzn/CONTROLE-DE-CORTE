import fs from "fs"
import path from "path"
import { ErroRegra } from "./corte-bloqueado"

type Produto = {codigo_produto: number; produto: string; controles: string[]}
type Catalogo = {origem: string; produtos: Produto[]; grupos: {id: string; nome: string; codigos: number[]}[]}
let catalogo: Catalogo | undefined
export function obterCatalogoSankhya(): Catalogo {
  if (!catalogo) catalogo = JSON.parse(fs.readFileSync(path.join(__dirname, "../public/data/sankhya-produtos.json"), "utf8"))
  return catalogo!
}

export function conferirDestinoCatalogo(destino: {codigo_produto: number; controle?: string | null}) {
  const produto = obterCatalogoSankhya().produtos.find(p => p.codigo_produto === destino.codigo_produto)
  if (!produto) throw new ErroRegra(400, `Produto ${destino.codigo_produto} fora do catálogo. Escolha um produto da lista.`)
  const recebido = destino.controle?.trim() ?? ""
  const normalizar = (valor: string) => valor.trim().replace(/\s+/g, " ").toUpperCase()
  if (!produto.controles.length) {
    if (recebido) throw new ErroRegra(400, `O produto ${produto.codigo_produto} não usa controle. Deixe o controle vazio.`)
    return {codigo_produto: produto.codigo_produto, produto: produto.produto, controle: ""}
  }
  const controle = produto.controles.find(c => normalizar(c) === normalizar(recebido))
  if (!controle) throw new ErroRegra(400, `Escolha somente o controle efetivamente cortado para o produto ${produto.codigo_produto}.`)
  return {codigo_produto: produto.codigo_produto, produto: produto.produto, controle}
}
