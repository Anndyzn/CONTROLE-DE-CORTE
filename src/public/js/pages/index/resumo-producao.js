export function montarResumoProducao(dados) {
  const inicio = dados.horaInicio || 'início pendente'
  const fim = dados.horaFim || 'término pendente'
  const diaSeguinte = dados.horaInicio && dados.horaFim && dados.horaFim < dados.horaInicio
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(dados.data || '') ? dados.data.split('-').reverse().join('/') : 'data pendente'
  const folha = valor => valor === '' || valor == null ? '—' : String(valor)
  return {
    linha: `${dados.operador || 'operador pendente'} · ${dados.mesa || 'mesa pendente'} · ${inicio} → ${fim}${diaSeguinte ? ' (dia seguinte)' : ''}`,
    detalhe: `Corte ${dados.numero || '—'} · ${dia} · ${dados.turno || 'turno pendente'} · Folhas ${folha(dados.folhaInicio)} → ${folha(dados.folhaFim)}`,
    situacao: dados.status === 'FINALIZADO' ? 'Vai finalizar o corte. Depois, cadastre e confirme os PIs.' : dados.status === 'EM PRODUÇÃO' ? 'O corte continua em produção.' : 'Selecione a situação do corte.'
  }
}

export function inicializarResumoProducao() {
  const campo = id => document.getElementById(id)
  const painel = campo('resumoAntesSalvar'), secao = campo('secaoProducao')
  if (!painel || !secao || painel.dataset.inicializado) return
  painel.dataset.inicializado = '1'
  const valor = id => campo(id)?.value || ''
  const texto = id => campo(id)?.textContent.trim() || ''
  const escrever = (id, valor) => { const e = campo(id); if (e && e.textContent !== valor) e.textContent = valor }
  function atualizar() {
    painel.hidden = !secao.classList.contains('producao-vinculada') || secao.classList.contains('aguardando-inicio') || secao.hidden
    if (painel.hidden) return
    const resumo = montarResumoProducao({
      numero: texto('numeroCorteSelecionado'), mesa: texto('mesa'), data: valor('data'), turno: valor('turno'),
      operador: valor('operador') === 'OUTRO' ? valor('operadorOutro').trim() : valor('operador'),
      horaInicio: valor('horaInicio'), horaFim: valor('horaFim'), folhaInicio: valor('folhaInicio'), folhaFim: valor('folhaParouInput'), status: valor('statusProducao')
    })
    escrever('resumoProducaoLinha', resumo.linha)
    escrever('resumoProducaoDetalhe', resumo.detalhe)
    escrever('resumoProducaoSituacao', resumo.situacao)
    painel.dataset.finaliza = String(valor('statusProducao') === 'FINALIZADO')
  }
  secao.addEventListener('input', atualizar)
  secao.addEventListener('change', atualizar)
  // Os botões Agora preenchem o valor sem emitir input.
  for (const id of ['preencherHoraInicio', 'preencherHoraFim']) campo(id)?.addEventListener('click', () => queueMicrotask(atualizar))
  // Confirmação/correção do início e restauração do rascunho preenchem campos por código.
  const observador = new MutationObserver(atualizar)
  observador.observe(secao, { attributes: true, attributeFilter: ['class', 'hidden'] })
  for (const id of ['numeroCorteSelecionado', 'mesa', 'trabalhoSelecionadoResumo']) {
    const origem = campo(id)
    if (origem) observador.observe(origem, { childList: true, characterData: true, subtree: true })
  }
  atualizar()
}
