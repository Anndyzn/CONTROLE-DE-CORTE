const numero = v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const data = v => new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })

// Elementos e textContent preservam NF/observações como texto, inclusive na impressão.
export function imprimirTecidos(dados, status, busca) {
  document.getElementById('impressaoTecidosFrame')?.remove()
  const frame = document.createElement('iframe')
  frame.id = 'impressaoTecidosFrame'
  frame.title = 'Impressão dos tecidos com defeito'
  Object.assign(frame.style, { position: 'fixed', width: '1px', height: '1px', left: '-9999px', border: '0' })
  document.body.append(frame)
  const doc = frame.contentDocument
  doc.open(); doc.write('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Tecidos com defeito</title></head><body></body></html>'); doc.close()
  const el = (tag, texto, pai) => { const e = doc.createElement(tag); if (texto != null) e.textContent = texto; pai?.append(e); return e }
  const style = el('style', `@page{size:A4 landscape;margin:12mm}body{font:10px Arial,sans-serif;color:#111}h1{font-size:20px;margin:0 0 7px}p{margin:6px 0 12px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #aaa;padding:6px;text-align:left;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap}th{background:#eee}thead{display:table-header-group}tr{break-inside:avoid}th:nth-child(1){width:13%}th:nth-child(3){width:7%}th:nth-child(4){width:15%}tfoot td{font-weight:bold}tfoot{display:table-row-group}`, doc.head)
  el('h1', 'TECIDOS COM DEFEITO', doc.body)
  el('p', `${status === 'PENDENTE' ? 'Pendentes' : 'Resolvidos'} · Emitido em ${data(new Date())}${busca ? ` · Busca: ${busca}` : ''}`, doc.body)
  const table = el('table', null, doc.body), head = el('tr', null, el('thead', null, table))
  for (const titulo of ['NF', 'Tecido / cor', 'Metros', 'Defeito', status === 'RESOLVIDO' ? 'Observação / atendimento' : 'Observação']) el('th', titulo, head)
  const body = el('tbody', null, table)
  el('style', '.inicio-nf td{border-top:2px solid #555}', doc.head)
  let nfAnterior = null
  for (const item of dados.itens) {
    const tr = el('tr', null, body)
    if (nfAnterior !== null && item.nf !== nfAnterior) tr.className = 'inicio-nf'
    nfAnterior = item.nf
    const obs = [item.observacao, status === 'RESOLVIDO' && item.resolucao ? `Atendimento: ${item.resolucao}` : '', status === 'RESOLVIDO' && item.resolvido_em ? `Resolvido em ${data(item.resolvido_em)}` : ''].filter(Boolean).join('\n')
    for (const valor of [item.nf, `${item.tecido}${item.cor ? ` · ${item.cor}` : ''}`, numero(item.metros), item.defeitos.join(', '), obs || '—']) el('td', valor, tr)
  }
  const total = el('td', `${dados.resumo.quantidade} peça(s) · Total: ${numero(dados.resumo.metros)} m`, el('tr', null, el('tfoot', null, table)))
  total.colSpan = 5
  frame.contentWindow.addEventListener('afterprint', () => frame.remove(), { once: true })
  frame.contentWindow.focus()
  frame.contentWindow.print()
}
