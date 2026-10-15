const CHAVE = "controle-corte:rascunhos:v1"
const grupos = ["novo", "producao", "item"]

export class Rascunhos {
  constructor(armazenamento) { this.armazenamento = armazenamento }

  ler() {
    const bruto = this.armazenamento.getItem(CHAVE)
    if (!bruto) return {}
    const dados = JSON.parse(bruto)
    if (dados.versao !== 1 || !dados.cortes || typeof dados.cortes !== "object" || Array.isArray(dados.cortes)) {
      throw new Error("Formato de rascunho inválido")
    }
    return Object.fromEntries(Object.entries(dados.cortes).filter(([numero, corte]) =>
      /^[1-9]\d{0,9}$/.test(numero) && Number(numero) <= 2147483647
      && corte && String(corte.numero) === numero && typeof corte.novo === "boolean"
      && corte.grupos && typeof corte.grupos === "object"
    ))
  }

  gravar(cortes) {
    this.armazenamento.setItem(CHAVE, JSON.stringify({versao:1, cortes}))
  }

  salvar(numero, novo, grupo, campos, base) {
    numero = String(numero)
    if (!/^[1-9]\d{0,9}$/.test(numero) || Number(numero) > 2147483647 || !grupos.includes(grupo)) return
    const cortes = this.ler()
    const anterior = cortes[numero]
    const corte = anterior?.novo === novo ? anterior : {numero, novo, grupos:{}}
    corte.salvoEm = new Date().toISOString()
    corte.grupos[grupo] = {campos, base, versao:`${Date.now()}:${Math.random()}`}
    cortes[numero] = corte
    this.gravar(cortes)
  }

  excluirGrupo(numero, grupo, versao) {
    const cortes = this.ler()
    const corte = cortes[numero]
    if (!corte || (versao !== undefined && corte.grupos[grupo]?.versao !== versao)) return
    delete corte.grupos[grupo]
    if (!Object.keys(corte.grupos).length) delete cortes[numero]
    this.gravar(cortes)
  }

  excluir(numero) {
    const cortes = this.ler()
    delete cortes[numero]
    this.gravar(cortes)
  }
}
