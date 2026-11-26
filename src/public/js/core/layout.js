import { inicializarVisaoInicio } from '../pages/index/layout-inicio.js'
import { inicializarLembreteTurno } from './lembrete-turno.js'

const chaveMenu = 'controle-corte.menu-recolhido'

export function inicializarLayout() {
  const nav = document.querySelector('.system-nav')
  const conteudo = document.querySelector('body > .container')
  if (!nav || !conteudo || document.body.classList.contains('app-layout')) return
  const criar = (tag, classe, texto) => {
    const e = document.createElement(tag); e.className = classe
    if (texto) e.textContent = texto
    return e
  }
  const sidebar = criar('aside', 'app-sidebar')
  sidebar.setAttribute('aria-label', 'Menu do sistema')
  const topo = criar('div', 'sidebar-topo')
  const marca = criar('a', 'sidebar-marca')
  marca.href = 'index.html'; marca.setAttribute('aria-label', 'Dimepor — início')
  const logo = criar('span', 'sidebar-logo'); logo.setAttribute('aria-hidden', 'true')
  const nome = criar('span', 'sidebar-nome')
  nome.append(criar('strong', '', 'DIMEPOR'), criar('small', '', 'Controle de produção'))
  marca.append(logo, nome)
  const toggle = criar('button', 'sidebar-toggle')
  toggle.type = 'button'; toggle.setAttribute('aria-controls', 'menuLateralSistema')
  const icone = criar('span', 'sidebar-toggle-icone', '‹'); icone.setAttribute('aria-hidden', 'true')
  toggle.append(icone)
  topo.append(marca, toggle)
  nav.id = 'menuLateralSistema'
  for (const link of nav.querySelectorAll('a')) {
    const texto = link.textContent.trim()
    link.setAttribute('aria-label', texto); link.title = texto
    link.replaceChildren(criar('span', 'sidebar-link-texto', texto))
  }
  sidebar.append(topo, criar('p', 'sidebar-secao', 'Área de trabalho'), nav, criar('div', 'sidebar-rodape', 'Organização em cada etapa.'))
  const pular = criar('a', 'pular-conteudo', 'Ir para o conteúdo')
  conteudo.id ||= 'conteudoPrincipal'; conteudo.setAttribute('tabindex', '-1')
  pular.href = `#${conteudo.id}`
  document.body.prepend(pular, sidebar)
  let recolhido = false
  try {
    const salvo = localStorage.getItem(chaveMenu)
    recolhido = salvo === null ? window.matchMedia('(max-width: 1050px)').matches : salvo === '1'
  } catch { recolhido = window.matchMedia('(max-width: 1050px)').matches }
  const aplicar = () => {
    document.body.classList.toggle('menu-recolhido', recolhido)
    toggle.setAttribute('aria-expanded', String(!recolhido))
    toggle.setAttribute('aria-label', recolhido ? 'Expandir menu lateral' : 'Recolher menu lateral')
    toggle.title = recolhido ? 'Expandir menu' : 'Recolher menu'
  }
  toggle.addEventListener('click', () => {
    recolhido = !recolhido; aplicar()
    try { localStorage.setItem(chaveMenu, recolhido ? '1' : '0') } catch { /* Menu continua funcionando sem armazenamento. */ }
  })
  aplicar()
  document.body.classList.add('app-layout')
  if (document.body.classList.contains('page-index')) inicializarVisaoInicio()
  inicializarLembreteTurno()
}

inicializarLayout()
