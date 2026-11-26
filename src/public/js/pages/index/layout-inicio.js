export function inicializarVisaoInicio() {
  const selecionado = document.getElementById('corteSelecionado')
  const mesas = document.querySelector('.mesas-painel')
  const busca = document.querySelector('.busca-corte-card')
  if (!selecionado || !mesas || !busca) return
  document.body.classList.add('home-organizada')
  mesas.before(busca)
  const criar = (tag, classe, texto) => {
    const e = document.createElement(tag); e.className = classe
    if (texto) e.textContent = texto
    return e
  }
  const barra = criar('div', 'home-contexto-barra')
  barra.id = 'contextoTrabalhoInicio'; barra.hidden = true
  const voltar = criar('button', 'btn-secondary home-voltar', '← Voltar às mesas')
  voltar.type = 'button'
  const rotulo = criar('span', 'home-contexto-rotulo', 'Área de lançamento')
  const atalhos = criar('nav', 'home-atalhos-corte')
  atalhos.setAttribute('aria-label', 'Seções do corte aberto')
  const links = []
  const movimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
  const proxima = criar('div', 'corte-proxima-acao')
  const proximaRotulo = criar('span', '', 'Próximo passo')
  const proximaLink = criar('a', 'corte-proxima-link')
  let destinoProximo = null, focoProximo = null
  proxima.append(proximaRotulo, proximaLink); selecionado.append(proxima)
  proximaLink.addEventListener('click', e => {
    if (!destinoProximo) return
    const destino = document.getElementById(destinoProximo)
    if (!destino || destino.hidden || destino.style.display === 'none') return
    e.preventDefault()
    destino.scrollIntoView({ behavior: movimento(), block: 'start' })
    const foco = document.getElementById(focoProximo)
    if (foco && !foco.disabled && !foco.hidden) foco.focus({ preventScroll: true })
    else { destino.setAttribute('tabindex', '-1'); destino.focus({ preventScroll: true }) }
  })
  function atualizarProximoPasso() {
    const finalizado = document.getElementById('status')?.textContent.includes('FINALIZADO')
    const pisConfirmados = document.getElementById('proximaEtapaPis')
    const producao = document.getElementById('secaoProducao')
    const painelTrabalhos = document.getElementById('painelTrabalhos')
    const emTrabalho = producao?.classList.contains('producao-vinculada') || (painelTrabalhos && !painelTrabalhos.hidden)
    destinoProximo = finalizado ? 'blocoItensCorte' : 'secaoProducao'
    focoProximo = finalizado ? 'modeloItem' : emTrabalho ? (producao?.classList.contains('aguardando-inicio') ? 'usarInicioTrabalho' : 'horaFim') : 'assumirCorteSelecionado'
    let texto = finalizado ? 'Cadastrar e confirmar PIs →' : emTrabalho ? 'Concluir trabalho →' : 'Registrar início →'
    proximaLink.href = `#${destinoProximo}`
    if (finalizado && pisConfirmados && !pisConfirmados.hidden) {
      texto = 'Conferir no Sankhya ↗'
      proximaLink.href = document.getElementById('abrirSankhyaPis')?.href || `sankhya.html?corte=${encodeURIComponent(numeroAnterior || '')}`
      destinoProximo = null
    }
    // Evita gerar novas mutações no cartão quando o estado não mudou.
    if (proximaLink.textContent !== texto) proximaLink.textContent = texto
    if (proxima.hidden !== selecionado.hidden) proxima.hidden = selecionado.hidden
  }
  for (const [id, texto] of [['secaoProducao', 'Produção'], ['blocoItensCorte', 'PIs'], ['secaoHistorico', 'Histórico']]) {
    const link = criar('a', '', texto)
    link.href = `#${id}`
    link.addEventListener('click', e => {
      const destino = document.getElementById(id)
      if (!destino || destino.hidden || destino.style.display === 'none') return
      e.preventDefault()
      destino.scrollIntoView({ behavior: movimento(), block: 'start' })
      destino.setAttribute('tabindex', '-1'); destino.focus({ preventScroll: true })
    })
    atalhos.append(link); links.push({ id, link })
  }
  barra.append(voltar, rotulo, atalhos)
  selecionado.before(barra)

  const retomada = criar('div', 'home-retomar')
  retomada.hidden = true
  const descricao = criar('span', '')
  const continuar = criar('button', 'btn-secondary', 'Continuar corte')
  continuar.type = 'button'
  retomada.append(descricao, continuar)
  busca.before(retomada)

  let visivelAnterior = !selecionado.hidden
  let trabalhando = visivelAnterior
  let rolagemMesas = Number(window.scrollY) || 0, rolagemCorte = null, numeroAnterior = null, pedidoRolagem = 0
  function restaurarRolagem(posicao) {
    const pedido = ++pedidoRolagem
    window.requestAnimationFrame(() => {
      if (pedido === pedidoRolagem) window.scrollTo({ top: Math.max(0, posicao || 0), behavior: movimento() })
    })
  }
  function aplicar() {
    const visivel = !selecionado.hidden
    if (!visivel) trabalhando = false
    const numero = document.getElementById('numeroCorteSelecionado')?.textContent.trim()
    if (numero !== numeroAnterior) { rolagemCorte = null; numeroAnterior = numero }
    document.body.classList.toggle('home-em-corte', trabalhando && visivel)
    barra.hidden = !trabalhando || !visivel
    retomada.hidden = trabalhando || !visivel
    descricao.textContent = `Corte ${numero || ''} aberto · ${document.getElementById('produto')?.textContent || ''}`
    continuar.textContent = `Continuar corte ${numero || ''}`
    rotulo.textContent = `Corte ${numero || ''}`
    for (const { id, link } of links) {
      const destino = document.getElementById(id)
      link.hidden = !destino || destino.hidden || destino.style.display === 'none'
    }
    atualizarProximoPasso()
  }
  voltar.addEventListener('click', () => {
    rolagemCorte = Number(window.scrollY) || 0
    trabalhando = false; aplicar()
    restaurarRolagem(rolagemMesas)
  })
  continuar.addEventListener('click', () => {
    rolagemMesas = Number(window.scrollY) || 0
    trabalhando = true; aplicar()
    if (rolagemCorte !== null) restaurarRolagem(rolagemCorte)
    else selecionado.scrollIntoView({ behavior: movimento(), block: 'start' })
  })
  const observar = new MutationObserver(() => {
    const visivel = !selecionado.hidden
    // Atualizações em tempo real não tiram a pessoa da visão geral.
    if (visivel !== visivelAnterior) {
      if (visivel) rolagemMesas = Number(window.scrollY) || 0
      trabalhando = visivel; visivelAnterior = visivel
    }
    aplicar()
  })
  observar.observe(selecionado, { attributes: true, attributeFilter: ['hidden'], subtree: true, childList: true, characterData: true })
  for (const { id } of links) {
    const secao = document.getElementById(id)
    if (secao) observar.observe(secao, { attributes: true, attributeFilter: ['hidden', 'style', 'class'] })
  }
  for (const id of ['painelTrabalhos', 'proximaEtapaPis']) {
    const painel = document.getElementById(id)
    if (painel) observar.observe(painel, { attributes: true, attributeFilter: ['hidden'] })
  }

  // Recolhe apenas a apresentação dos recentes; os controles e IDs permanecem os mesmos.
  const finalizados = document.querySelector('.finalizados-recentes-card')
  const cabecalho = finalizados?.querySelector('.finalizados-cabecalho')
  if (finalizados && cabecalho) {
    const painel = criar('details', `${finalizados.className} home-finalizados-painel`)
    for (const attr of finalizados.attributes) if (attr.name !== 'class') painel.setAttribute(attr.name, attr.value)
    const resumo = criar('summary', 'home-finalizados-resumo')
    resumo.append(cabecalho)
    const conteudo = criar('div', 'home-finalizados-conteudo')
    while (finalizados.firstChild) conteudo.append(finalizados.firstChild)
    painel.append(resumo, conteudo); finalizados.replaceWith(painel)
  }
  for (const [seletor, nome] of [['.lista-andamento', 'andamento'], ['.home-finalizados-painel', 'finalizados'], ['#painelPisPendentes', 'pis-pendentes']]) {
    const painel = seletor.startsWith('#') ? document.getElementById(seletor.slice(1)) : document.querySelector(seletor)
    if (!painel) continue
    const chave = `controle-corte.painel-${nome}`
    try { const salvo = localStorage.getItem(chave); if (salvo !== null) painel.open = salvo === '1' } catch { /* Preferência opcional. */ }
    painel.addEventListener('toggle', () => {
      try { localStorage.setItem(chave, painel.open ? '1' : '0') } catch { /* Funciona sem armazenamento. */ }
    })
  }
  aplicar()
}
