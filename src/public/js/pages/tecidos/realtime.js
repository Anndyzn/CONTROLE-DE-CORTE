// SSE avisa imediatamente as outras abas. A conferência periódica cobre reconexões,
// alterações feitas fora desta instância e navegadores sem EventSource.
export function iniciarAtualizacaoTecidos({ atualizar, ocupado, indicar }) {
  let canal = null, timer = null, agendamento = null, ativo = true, executando = false, pendente = false
  let conectado = false
  async function executar() {
    agendamento = null
    if (!ativo || document.hidden || ocupado()) { pendente = true; return }
    if (executando) { pendente = true; return }
    pendente = false; executando = true
    try {
      const ok = await atualizar()
      if (ativo) indicar(ok ? (conectado ? 'Ao vivo' : 'Atualização automática') : 'Falha ao atualizar', ok ? 'ok' : 'erro')
    } catch { if (ativo) indicar('Sem conexão', 'erro') }
    finally {
      executando = false
      if (pendente && ativo) solicitar()
    }
  }
  function solicitar() {
    pendente = true
    if (!ativo || agendamento !== null || executando || document.hidden || ocupado()) return
    agendamento = setTimeout(executar, 250)
  }
  function conectar() {
    if (!ativo) return
    indicar('Conectando', 'aviso')
    if (typeof EventSource !== 'undefined') {
      canal = new EventSource('/tecidos-defeitos/atualizacoes')
      canal.addEventListener('conectado', () => { conectado = true; solicitar() })
      canal.addEventListener('alteracao', solicitar)
      canal.addEventListener('error', () => { conectado = false; indicar('Reconectando', 'aviso'); solicitar() })
    } else indicar('Atualização automática', 'aviso')
    timer = setInterval(solicitar, 15000)
  }
  const visibilidade = () => { if (!document.hidden) solicitar() }
  const pausar = () => {
    ativo = false; conectado = false; canal?.close(); canal = null
    clearInterval(timer); clearTimeout(agendamento); timer = null; agendamento = null
  }
  const retornar = e => { if (e.persisted && !ativo) { ativo = true; conectar(); solicitar() } }
  document.addEventListener('visibilitychange', visibilidade)
  window.addEventListener('online', solicitar)
  window.addEventListener('offline', () => { conectado = false; indicar('Sem conexão', 'erro') })
  window.addEventListener('pagehide', pausar)
  window.addEventListener('pageshow', retornar)
  conectar()
  return { retomar: () => { if (pendente) solicitar() } }
}
