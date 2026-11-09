# Padronização de nomes existentes

No **Admin**, abra **Padronizar nomes**, abaixo da busca de corte.

1. Escolha **Modelos dos PIs** ou **Nomes dos cortes**.
2. Busque uma parte do nome, como `CONJUNTO`. A busca aceita letras minúsculas e palavras sem os acentos portugueses mais comuns.
3. Marque somente as variações que representam o mesmo produto. Cada linha mostra a quantidade de registros e de cortes.
4. Digite o nome correto, ou clique em **Usar nome** em uma das grafias existentes.
5. Clique em **Conferir alterações** e revise cada registro da lista.
6. Clique em **Confirmar padronização** e informe o responsável e o motivo.

O destino é convertido para letras maiúsculas, com espaços normalizados. As origens são
selecionadas exatamente como estão salvas. Registros que já possuem exatamente o destino
não são alterados. Não há aproximação automática por grafia, nem união de produtos apenas
porque seus nomes são parecidos.

Cada operação permite até 100 nomes de origem e 2.000 registros. A consulta lista até 1.000
nomes; refine a busca quando houver mais. Cores e tecidos não são alterados nesta etapa.

## Dados preservados e histórico

A alteração inclui cortes e PIs antigos ou finalizados e corrige somente o campo escolhido:
`cortes.produto` ou `itens_corte.modelo`. Números de corte, mesas, status, produção,
quantidades, metragem, perdas e sobras são preservados.

Cada registro alterado recebe um evento no histórico administrativo, com antes/depois,
responsável informado e motivo. A identidade do responsável continua sendo declarada
pela pessoa, seguindo o funcionamento existente do sistema.

A prévia é vinculada à seleção, ao destino e aos registros consultados. Para modelos,
também é vinculada às versões das correspondências Sankhya. Uma alteração no intervalo
exige nova prévia. Alterar a seleção ou o destino na tela também descarta a prévia anterior.

O servidor aplica a correção e a auditoria em uma única transação. Uma falha desfaz tudo.
Durante a gravação, as tabelas de cortes, itens e correspondências são bloqueadas para
outras gravações e bloqueios de linha; consultas simples continuam disponíveis. A espera
por bloqueios tem limite de cinco segundos. Em caso de conflito, atualize a prévia.

## Correspondências com o Sankhya

Quando um modelo é padronizado, suas correspondências são copiadas para o novo nome,
conservando produtos e controles de destino. As antigas permanecem disponíveis para
grafias que ainda existam em outros registros ou rascunhos.

Se o novo nome ou duas variações selecionadas possuírem produtos/controles diferentes
para o mesmo tecido e cor, a operação é bloqueada antes de gravar. Revise as correspondências
na tela **Sankhya** antes de tentar novamente. Correspondências equivalentes são reutilizadas.
As cópias criadas ficam documentadas no histórico da primeira correção do lote.

Nenhum dado é enviado ao ERP durante a padronização.

## Sugestões em novos cadastros

Os campos **Produto** do novo corte e **Produto Cortado** dos PIs oferecem até cinco
sugestões baseadas nos nomes já registrados. A lista é atualizada conforme a digitação
e ao entrar no campo. A seleção é opcional; continua possível escrever um nome novo.
Após corrigir as variações existentes, as sugestões passam a refletir os nomes padronizados.

Rascunhos locais e relatórios Excel já baixados não são reescritos pela padronização.
Ao restaurar um rascunho, confira os nomes antes de salvar. Novos relatórios usam os dados atuais.

## Validação técnica

- `npm.cmd test`: regras, prévia, conflito de versão, transação simulada, interface e sugestões.
- `npm.cmd run test:padronizacao`: teste em PostgreSQL 17 descartável via Docker, incluindo
  falha real de auditoria com rollback, preservação dos demais campos e busca por acentos.
  Usa dados fictícios e uma conexão própria; não carrega o banco da empresa.
