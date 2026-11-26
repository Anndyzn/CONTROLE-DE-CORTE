import { apiGet, apiPost, apiPut, apiDelete } from '../../core/api.js'
import { imprimirTecidos } from './impressao.js'
import { iniciarAtualizacaoTecidos } from './realtime.js'

const $ = id => document.getElementById(id)
const numero = v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const data = v => new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
let status = 'PENDENTE', busca = '', pagina = 1, total = 0, consulta = 0, selecionado = null, enviando = false
let chave = crypto.randomUUID(), assinatura = ''
let cargas = 0, sincronizacao = null
let filtroExibido = null
let acaoTecido = 'situacao'
const selecaoTecidos = new Map(), checksTecidos = new Map()
let pecasVisiveis = []
const form = $('formTecido'), dialog = $('dialogSituacaoTecido')
function mensagem(texto, tipo = 'erro') {
  $('mensagemTecidos').textContent = texto
  $('mensagemTecidos').dataset.tipo = tipo
  $('mensagemTecidos').hidden = !texto
}
function elemento(tag, texto, pai, classe) {
  const e = document.createElement(tag)
  if (texto != null) e.textContent = texto
  if (classe) e.className = classe
  pai?.append(e)
  return e
}
function cadastro(aberto) {
  if (enviando) return
  $('cadastroTecido').hidden = !aberto
  $('abrirCadastroTecido').setAttribute('aria-expanded', String(aberto))
  if (aberto) $('nfTecido').focus()
}
function atualizarSelecaoTecidos() {
  const pendentes = status === 'PENDENTE'
  $('acoesSelecaoTecidos').hidden = !pendentes || !selecaoTecidos.size
  $('contadorSelecaoTecidos').textContent = `${selecaoTecidos.size} peça(s) selecionada(s)`
  $('selecionarPaginaTecidos').hidden = !pendentes
  $('ajudaSelecaoTecidos').hidden = !pendentes
  const marcadas = pecasVisiveis.filter(i => selecaoTecidos.has(String(i.id))).length
  $('selecionarPaginaTecidos').checked = !!pecasVisiveis.length && marcadas === pecasVisiveis.length
  $('selecionarPaginaTecidos').indeterminate = marcadas > 0 && marcadas < pecasVisiveis.length
  $('selecionarPaginaTecidos').disabled = !pecasVisiveis.length
  for (const [id, check] of checksTecidos) check.checked = selecaoTecidos.has(id)
}
function limparSelecaoTecidos() { selecaoTecidos.clear(); atualizarSelecaoTecidos() }
function renderizar(itens) {
  const corpo = $('listaTecidos'); corpo.replaceChildren()
  pecasVisiveis = itens; checksTecidos.clear()
  let nfAnterior = null
  for (const item of itens) {
    const novaNF = nfAnterior !== null && item.nf !== nfAnterior
    const tr = elemento('tr', null, corpo, [status === 'RESOLVIDO' ? 'tecidos-resolvido' : '', novaNF ? 'tecidos-inicio-nf' : ''].filter(Boolean).join(' '))
    nfAnterior = item.nf
    const celulaNF = elemento('td', null, tr)
    if (status === 'PENDENTE') {
      const check = elemento('input', null, celulaNF)
      check.type = 'checkbox'; check.setAttribute('aria-label', `Selecionar peça ${item.id}, NF ${item.nf}, ${item.tecido}`)
      checksTecidos.set(String(item.id), check)
      check.addEventListener('change', () => {
        if (check.checked) {
          if (selecaoTecidos.size >= 200 && !selecaoTecidos.has(String(item.id))) { check.checked = false; mensagem('Selecione até 200 peças por atendimento.'); return }
          selecaoTecidos.set(String(item.id), item)
        } else selecaoTecidos.delete(String(item.id))
        atualizarSelecaoTecidos()
      })
    }
    elemento('span', item.nf, celulaNF)
    const tecido = elemento('td', null, tr)
    elemento('strong', item.tecido, tecido)
    if (item.cor) elemento('small', item.cor, tecido)
    elemento('td', numero(item.metros), tr)
    const defeitos = elemento('td', null, tr)
    for (const defeito of item.defeitos) elemento('span', defeito, defeitos, 'tecidos-tag')
    const obs = elemento('td', item.observacao || '—', tr)
    if (status === 'RESOLVIDO' && item.resolucao) elemento('small', `Atendimento: ${item.resolucao}`, obs, 'tecidos-atendimento')
    elemento('td', data(status === 'RESOLVIDO' ? item.resolvido_em : item.criado_em), tr)
    const acoes = elemento('td', null, tr, 'tecidos-acoes-linha')
    const btn = elemento('button', status === 'PENDENTE' ? 'Resolver' : 'Reabrir', acoes, 'btn-secondary')
    btn.type = 'button'; btn.addEventListener('click', () => abrirSituacao(item))
    const excluir = elemento('button', 'Excluir', acoes, 'btn-excluir-tecido')
    excluir.type = 'button'; excluir.addEventListener('click', () => abrirSituacao(item, true))
  }
  $('areaTabelaTecidos').hidden = !itens.length
  $('vazioTecidos').hidden = !!itens.length
  $('tituloVazioTecidos').textContent = busca ? 'Nenhuma peça encontrada' : status === 'PENDENTE' ? 'Nenhuma peça pendente' : 'Nenhuma peça resolvida'
  $('textoVazioTecidos').textContent = busca ? 'Tente outra NF, tecido ou cor.' : status === 'PENDENTE' ? 'As peças registradas aparecerão aqui até serem atendidas.' : 'As peças atendidas ficam guardadas aqui e podem ser reabertas.'
  const paginas = Math.max(1, Math.ceil(total / 50))
  $('paginacaoTecidos').hidden = paginas <= 1
  $('paginaTecidos').textContent = `Página ${pagina} de ${paginas}`
  $('anteriorTecidos').disabled = pagina <= 1
  $('proximaTecidos').disabled = pagina >= paginas
  atualizarSelecaoTecidos()
}
async function carregar(silencioso = false) {
  const atual = ++consulta
  const filtroAtual = JSON.stringify([status, busca, pagina])
  const manterLista = filtroExibido === filtroAtual
  cargas++
  $('areaTabelaTecidos').setAttribute('aria-busy', 'true')
  $('imprimirTecidos').disabled = true
  // Não deixa ações de uma aba anterior visíveis enquanto outra está carregando.
  if (!silencioso && !manterLista) {
    filtroExibido = null
    pecasVisiveis = []; checksTecidos.clear(); atualizarSelecaoTecidos()
    $('listaTecidos').replaceChildren(); $('vazioTecidos').hidden = true
    $('resumoTecidos').textContent = 'Carregando peças...'
  }
  if (!silencioso && manterLista) $('resumoTecidos').textContent = 'Atualizando peças…'
  try {
    const r = await apiGet(`/tecidos-defeitos?${new URLSearchParams({ status, busca, pagina })}`)
    if (atual !== consulta) return
    total = r.resumo.quantidade
    if (pagina > 1 && (pagina - 1) * 50 >= total) { pagina--; return carregar() }
    $('resumoTecidos').textContent = `${total} peça(s) ${status === 'PENDENTE' ? 'pendente(s)' : 'resolvida(s)'} · ${numero(r.resumo.metros)} m${busca ? ' · resultados da busca' : ''}`
    renderizar(r.itens)
    filtroExibido = filtroAtual
    $('imprimirTecidos').disabled = !total
    return true
  } catch (e) {
    if (atual !== consulta) return
    if (!silencioso) {
      $('resumoTecidos').textContent = manterLista ? 'Não foi possível atualizar. Exibindo a última lista recebida. Use Atualizar para tentar novamente.' : 'Não foi possível carregar a lista. Use Atualizar para tentar novamente.'
      mensagem(e.message)
    }
    return false
  } finally {
    cargas--
    if (atual === consulta) $('areaTabelaTecidos').setAttribute('aria-busy', 'false')
    sincronizacao?.retomar()
  }
}
function trocarAba(nova) {
  status = nova; pagina = 1; mensagem('')
  limparSelecaoTecidos()
  $('abaPendentesTecido').setAttribute('aria-pressed', String(status === 'PENDENTE'))
  $('abaResolvidosTecido').setAttribute('aria-pressed', String(status === 'RESOLVIDO'))
  $('tituloLista').textContent = status === 'PENDENTE' ? 'Peças pendentes' : 'Peças resolvidas'
  $('colunaDataTecido').textContent = status === 'PENDENTE' ? 'Registrado em' : 'Resolvido em'
  $('imprimirTecidos').textContent = status === 'PENDENTE' ? 'Imprimir pendentes' : 'Imprimir resolvidos'
  return carregar()
}
function atualizarRegras() {
  const defeitos = [...form.querySelectorAll('[name="defeito"]:checked')]
  form.querySelector('[name="defeito"]').setCustomValidity(defeitos.length ? '' : 'Selecione pelo menos um defeito.')
  $('obsTecido').required = defeitos.some(c => c.value === 'Outro')
  $('ajudaObsTecido').textContent = $('obsTecido').required ? 'obrigatória para Outro' : 'opcional'
  const metros = Number($('metrosTecido').value.replace(',', '.'))
  $('metrosTecido').setCustomValidity($('metrosTecido').value && !(metros > 0) ? 'Informe uma metragem maior que zero.' : '')
}
form.addEventListener('input', atualizarRegras)
form.addEventListener('submit', async e => {
  e.preventDefault(); if (enviando) return
  atualizarRegras(); if (!form.reportValidity()) return
  const dados = Object.fromEntries(new FormData(form))
  delete dados.defeito
  dados.defeitos = [...form.querySelectorAll('[name="defeito"]:checked')].map(c => c.value)
  const novaAssinatura = JSON.stringify(dados)
  if (assinatura && assinatura !== novaAssinatura) chave = crypto.randomUUID()
  assinatura = novaAssinatura
  const adicionar = e.submitter?.value === 'outro'
  enviando = true; $('camposTecido').disabled = true; $('fecharCadastroTecido').disabled = true
  mensagem('')
  try {
    await apiPost('/tecidos-defeitos', { ...dados, chave_envio: chave })
    chave = crypto.randomUUID(); assinatura = ''
    const manter = { nf: $('nfTecido').value, tecido: $('nomeTecido').value, cor: $('corTecido').value }
    form.reset()
    if (adicionar) { $('nfTecido').value = manter.nf; $('nomeTecido').value = manter.tecido; $('corTecido').value = manter.cor }
    enviando = false
    if (!adicionar) cadastro(false)
    atualizarRegras()
    await trocarAba('PENDENTE')
    // A busca pode ocultar a peça nova; não a mantém após cadastrar.
    if (busca) { busca = ''; $('buscaTecido').value = ''; await carregar() }
    mensagem('Peça registrada. Cada novo cadastro corresponde a outra peça ou rolo.', 'sucesso')
    if (adicionar) $('metrosTecido').focus()
  } catch (erro) { mensagem(erro.message) }
  finally { enviando = false; $('camposTecido').disabled = false; $('fecharCadastroTecido').disabled = false; if (adicionar && !$('cadastroTecido').hidden) $('metrosTecido').focus(); sincronizacao?.retomar() }
})
function abrirSituacao(item, excluir = false) {
  selecionado = item
  acaoTecido = excluir ? 'excluir' : 'situacao'
  const resolver = item.status === 'PENDENTE'
  $('tituloSituacaoTecido').textContent = excluir ? 'Excluir esta peça?' : resolver ? 'Marcar como resolvido?' : 'Reabrir esta peça?'
  $('descricaoSituacaoTecido').textContent = `NF ${item.nf} · ${item.tecido}${item.cor ? ` · ${item.cor}` : ''} · ${numero(item.metros)} m. ${excluir ? 'Somente esta peça será retirada das listas e da impressão. As outras peças da mesma NF serão mantidas.' : resolver ? 'A peça sairá das pendências e ficará em Resolvidos.' : 'A peça voltará para as pendências.'}`
  $('confirmarSituacaoTecido').textContent = excluir ? 'Excluir peça' : resolver ? 'Marcar como resolvido' : 'Reabrir peça'
  $('confirmarSituacaoTecido').className = excluir ? 'btn-excluir-tecido' : ''
  $('campoObsSituacaoTecido').hidden = excluir
  $('obsSituacaoTecido').value = ''; $('erroSituacaoTecido').hidden = true
  dialog.showModal()
}
$('formSituacaoTecido').addEventListener('submit', async e => {
  e.preventDefault(); if ($('confirmarSituacaoTecido').disabled || !selecionado) return
  const item = selecionado
  const excluir = acaoTecido === 'excluir'
  const lote = acaoTecido === 'lote'
  $('confirmarSituacaoTecido').disabled = true; $('cancelarSituacaoTecido').disabled = true; $('obsSituacaoTecido').disabled = true
  try {
    if (lote) await apiPost('/tecidos-defeitos/resolver-lote', { itens: item.map(i => ({ id: i.id, versao: i.versao })), observacao: $('obsSituacaoTecido').value })
    else if (excluir) await apiDelete(`/tecidos-defeitos/${item.id}`, { versao: item.versao })
    else await apiPut(`/tecidos-defeitos/${item.id}/situacao`, { versao: item.versao, status: item.status === 'PENDENTE' ? 'RESOLVIDO' : 'PENDENTE', observacao: $('obsSituacaoTecido').value })
    dialog.close(); selecionado = null
    if (lote) limparSelecaoTecidos()
    else { selecaoTecidos.delete(String(item.id)); atualizarSelecaoTecidos() }
    mensagem(lote ? `${item.length} peça(s) atendida(s) com a mesma observação. Disponíveis em Resolvidos.` : excluir ? 'Peça excluída. As outras peças da mesma NF foram mantidas.' : item.status === 'PENDENTE' ? 'Peça atendida. Ela está disponível em Resolvidos.' : 'Peça reaberta e disponível em Pendentes.', 'sucesso')
    await carregar()
  } catch (erro) { $('erroSituacaoTecido').textContent = `${erro.message} Se outra pessoa já alterou a peça, cancele e atualize a lista.`; $('erroSituacaoTecido').hidden = false }
  finally { $('confirmarSituacaoTecido').disabled = false; $('cancelarSituacaoTecido').disabled = false; $('obsSituacaoTecido').disabled = false }
})
dialog.addEventListener('cancel', e => { if ($('confirmarSituacaoTecido').disabled) e.preventDefault() })
dialog.addEventListener('close', () => sincronizacao?.retomar())
$('cancelarSituacaoTecido').addEventListener('click', () => dialog.close())
$('selecionarPaginaTecidos').addEventListener('change', () => {
  const marcar = $('selecionarPaginaTecidos').checked
  const novas = pecasVisiveis.filter(i => !selecaoTecidos.has(String(i.id)))
  if (marcar && selecaoTecidos.size + novas.length > 200) { mensagem('Selecione até 200 peças por atendimento.'); atualizarSelecaoTecidos(); return }
  for (const item of pecasVisiveis) {
    if (marcar) selecaoTecidos.set(String(item.id), item)
    else selecaoTecidos.delete(String(item.id))
  }
  atualizarSelecaoTecidos()
})
$('limparSelecaoTecidos').addEventListener('click', limparSelecaoTecidos)
$('resolverSelecaoTecidos').addEventListener('click', () => {
  if (!selecaoTecidos.size || status !== 'PENDENTE') return
  selecionado = [...selecaoTecidos.values()]; acaoTecido = 'lote'
  $('tituloSituacaoTecido').textContent = `Resolver ${selecionado.length} peça(s)?`
  const nfs = [...new Set(selecionado.map(i => i.nf))]
  $('descricaoSituacaoTecido').textContent = `${selecionado.length} peça(s) · ${numero(selecionado.reduce((s, i) => s + Number(i.metros), 0))} m · ${nfs.length} NF(s). A observação será registrada em todas as peças selecionadas, inclusive nas outras páginas. Elas ficarão disponíveis em Resolvidos.`
  $('confirmarSituacaoTecido').textContent = 'Resolver selecionadas'
  $('confirmarSituacaoTecido').className = ''
  $('campoObsSituacaoTecido').hidden = false
  $('obsSituacaoTecido').value = ''; $('erroSituacaoTecido').hidden = true
  dialog.showModal()
})
$('abrirCadastroTecido').addEventListener('click', () => cadastro($('cadastroTecido').hidden))
$('fecharCadastroTecido').addEventListener('click', () => cadastro(false))
$('abaPendentesTecido').addEventListener('click', () => trocarAba('PENDENTE'))
$('abaResolvidosTecido').addEventListener('click', () => trocarAba('RESOLVIDO'))
$('atualizarTecidos').addEventListener('click', () => { mensagem(''); limparSelecaoTecidos(); carregar() })
$('buscarTecidos').addEventListener('submit', e => { e.preventDefault(); busca = $('buscaTecido').value.trim(); pagina = 1; mensagem(''); limparSelecaoTecidos(); carregar() })
$('buscaTecido').addEventListener('search', () => { if (!$('buscaTecido').value) { busca = ''; pagina = 1; limparSelecaoTecidos(); carregar() } })
$('anteriorTecidos').addEventListener('click', () => { if (pagina > 1) { pagina--; carregar() } })
$('proximaTecidos').addEventListener('click', () => { if (pagina * 50 < total) { pagina++; carregar() } })
$('imprimirTecidos').addEventListener('click', async () => {
  const situacao = status, filtro = busca
  $('imprimirTecidos').disabled = true
  try {
    const r = await apiGet(`/tecidos-defeitos?${new URLSearchParams({ status: situacao, busca: filtro, imprimir: '1' })}`)
    if (!r.itens.length) { mensagem('Não há peças para imprimir. Atualize a lista.'); return }
    imprimirTecidos(r, situacao, filtro)
  } catch (e) { mensagem(e.message) }
  finally { $('imprimirTecidos').disabled = !total }
})
apiGet('/tecidos-defeitos/sugestoes').then(r => {
  for (const tecido of r.tecidos) { const option = elemento('option', null, $('sugestoesTecido')); option.value = tecido }
}).catch(() => {}) // Sugestões são opcionais; o cadastro continua permitindo texto livre.
atualizarRegras()
carregar()
sincronizacao = iniciarAtualizacaoTecidos({
  atualizar: () => carregar(true),
  ocupado: () => enviando || $('camposTecido').disabled || dialog.open || cargas > 0,
  indicar: (texto, tipo) => {
    $('syncTecidos').textContent = texto
    $('syncTecidos').dataset.estado = tipo
  }
})
