const chaveDispensa = 'controle-corte.lembrete-turno-dispensado'
let iniciado = false

// Cada turno tem uma hora de tolerância para abrir a página ou voltar da suspensão.
export function horarioLembrete(agora = new Date()) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(agora).map(p => [p.type, p.value]))
  const minutos = Number(partes.hour) * 60 + Number(partes.minute)
  const turno = minutos >= 360 && minutos < 420 ? '06:00' : minutos >= 450 && minutos < 510 ? '07:30' : null
  return {
    dia: `${partes.year}-${partes.month}-${partes.day}`,
    turno,
    ativo: !['Sat', 'Sun'].includes(partes.weekday) && turno !== null
  }
}

export function inicializarLembreteTurno() {
  if (iniciado) return
  iniciado = true
  const parametros = new URLSearchParams(window.location?.search || '')
  const simulacao = parametros.get('simularLembrete') === '1'
  const turnoSimulado = parametros.get('turno') === '0730' ? '07:30' : '06:00'
  const dispensas = new Map()
  let aviso = null, diaAviso = null
  const esconder = () => { aviso?.remove(); aviso = null; diaAviso = null }
  function verificar() {
    const horario = simulacao ? { dia: 'simulacao', turno: turnoSimulado, ativo: true } : horarioLembrete()
    const chave = horario.turno === '07:30' ? `${chaveDispensa}.0730` : chaveDispensa
    let dispensado = dispensas.get(chave)
    if (!simulacao) try { dispensado = localStorage.getItem(chave) || dispensado } catch { /* Funciona durante esta página sem armazenamento. */ }
    const referencia = `${horario.dia}-${horario.turno}`
    if (!horario.ativo || dispensado === horario.dia) { esconder(); return }
    if (document.visibilityState === 'hidden') return
    if (aviso && diaAviso === referencia) return
    esconder()
    aviso = document.createElement('aside')
    aviso.className = 'lembrete-turno'
    aviso.setAttribute('role', 'status')
    aviso.setAttribute('aria-live', 'polite')
    if (simulacao) {
      const legenda = document.createElement('small')
      legenda.className = 'lembrete-turno-simulacao'; legenda.textContent = `SIMULAÇÃO · lembrete das ${horario.turno}`
      aviso.append(legenda)
    }
    const titulo = document.createElement('strong'); titulo.textContent = `Bommmm diaaaaaaa! Bora trabalhar????? porque a vida não é um morango e NÃO SE ESQUEÇA DO LANÇAMENTOOOO! O T.I ANDYZINHO LINDEZO AGRADECE S2❣️ ${horario.turno}`
    const texto = document.createElement('p'); texto.textContent = 'Assuma sua mesa para registrar o início do turno e bora pra luta!!'
    const acoes = document.createElement('div'); acoes.className = 'lembrete-turno-acoes'
    const ver = document.createElement('a'); ver.href = 'index.html#painelMesas'; ver.textContent = 'Ver mesas'
    ver.addEventListener('click', e => {
      const mesas = document.getElementById('painelMesas')
      if (!mesas) return
      e.preventDefault()
      if (document.body.classList.contains('home-em-corte')) document.querySelector('.home-voltar')?.click()
      // Aguarda o retorno à visão geral sem alterar os dados do corte aberto.
      requestAnimationFrame(() => {
        mesas.scrollIntoView({ behavior: 'instant', block: 'center' })
        mesas.setAttribute('tabindex', '-1'); mesas.focus({ preventScroll: true })
      })
    })
    const fechar = document.createElement('button'); fechar.type = 'button'; fechar.textContent = 'Fechar'
    fechar.setAttribute('aria-label', `Fechar lembrete das ${horario.turno} hoje`)
    fechar.addEventListener('click', () => {
      dispensas.set(chave, horario.dia)
      if (!simulacao) try { localStorage.setItem(chave, horario.dia) } catch { /* Mantém a dispensa em memória. */ }
      esconder()
    })
    acoes.append(ver, fechar); aviso.append(titulo, texto, acoes); document.body.append(aviso)
    diaAviso = referencia
  }
  verificar()
  setInterval(verificar, 30000)
  document.addEventListener('visibilitychange', verificar)
  window.addEventListener('focus', verificar)
  window.addEventListener('storage', e => { if (e.key === chaveDispensa || e.key === `${chaveDispensa}.0730` || e.key === null) verificar() })
}
