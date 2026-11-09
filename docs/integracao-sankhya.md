# Guia de lançamento manual — Sankhya

## Fluxo sem acesso às APIs

O modo disponível é o apoio ao lançamento manual no ERP, sem exigir credenciais de API.
Depois de conferir todos os itens e salvar suas correspondências, use **Baixar guia em Excel**.
O arquivo é recalculado pelo servidor com os dados atuais e contém:

- **OPs para lançar**: uma linha por item/produto/controle, com código, nome e quantidade.
  A última coluna permite anotar o número da OP criada manualmente.
- **Consumo por item**: modelo, cor, tecido e metragem total do item original, uma única vez,
  mesmo quando o item corresponde a vários produtos no ERP.
- **Como usar**: orientações para conferir e lançar pelo procedimento habitual.

É um guia para digitação e conferência. Não é um arquivo de importação e não cria OPs.
Confira as OPs já existentes antes de lançar: baixar novamente não evita duplicação no ERP.
Números anotados no Excel não retornam automaticamente ao sistema.

O processo produtivo, planta, unidade e consumo previsto são conferidos no Sankhya.
O apontamento do consumo real, confirmação e finalização continuam no ERP.
O download exige todos os itens com correspondência e quantidades inteiras positivas.
Alterações não salvas no editor bloqueiam o botão; salve ou descarte antes de gerar.

## Etapa disponível

Na Home, abra **Sankhya**. Escolha um corte com produção finalizada e PIs confirmados.
A lista traz até 50 cortes recentes; números mais antigos podem ser digitados. Esses cortes
são candidatos à conferência: o sistema ainda não sabe quais foram lançados manualmente no ERP.

Selecione cada item e informe os produtos de destino, com código, descrição e controle
de cor exatamente como aparecem no Sankhya. As correspondências são compartilhadas pelos
cortes com o mesmo modelo, tecido e cor, normalizados por espaços e letras maiúsculas.
Acentos e grafias diferentes continuam separados. A edição usa versão para impedir
sobrescrever uma alteração feita por outra tela.

Um item pode corresponder a até dez produtos. Por exemplo, conjunto feminino branco,
216 unidades, pode gerar uma linha para blazer branco (216) e outra para vestido branco
(216). Cada linha representa uma OP prevista; não são agregadas linhas de itens distintos.
Essa relação de quantidade 1:1 por destino precisa ser conferida antes de usar o resultado.

Os códigos, nomes e controles são informados manualmente. Ainda não há validação contra
o cadastro real do ERP. Nenhuma correspondência de exemplo é instalada automaticamente.
O consumo total permanece no item original: a preparação não o divide nem o replica
nas OPs. Quantidades zero ou fracionadas impedem preparar a linha, sem alterar o item original.

## Persistência e execução

Ao iniciar (`npm.cmd run dev`, ou `npm.cmd start` depois de `npm.cmd run build`), o servidor
prepara a tabela `public.sankhya_correspondencias`, com chave modelo/tecido/cor, destinos JSONB,
versão e data da última alteração. A criação usa transação e bloqueio de migração, e habilita RLS
para impedir acesso direto pelos clientes Supabase. Usa a conexão de servidor já existente.
Não modifica tabelas ou registros de cortes, produção e itens.

O backup do schema `public` abrange também a nova tabela nos próximos backups.

Rotas locais:

- `GET /sankhya/cortes`: candidatos recentes à conferência.
- `GET /sankhya/cortes/:numero/conferencia`: leitura consistente dos itens e das correspondências.
- `GET /sankhya/cortes/:numero/excel`: guia XLSX somente com correspondências completas, usando nova leitura consistente.
- `PUT /sankhya/correspondencias`: grava somente a correspondência, com versão otimista.

## Possível integração futura

Não existe rota de envio ou credencial Sankhya nesta versão. A tela não cria OPs, não aponta
produção e não movimenta estoque. A conferência é recalculada ao consultar o corte.

Antes de implementar o envio, validar em homologação com o responsável pelo ERP:

- Serviço de criação de OP e versão/módulo habilitado. O Framework MES documenta apontamentos
  em atividades de OPs existentes; isso não comprova o serviço de criação de uma OP nova.
- Processo produtivo, planta, empresa, unidades, lote e demais campos obrigatórios.
- Produtos e controles reais, e cálculo da composição no lançamento.
- Persistência do vínculo item/produto/controle → número da OP e referência de origem no ERP.
- Reconciliação de respostas incertas antes de repetir uma criação, para impedir duplicatas.
- Tratamento de alterações/reaberturas após o envio e OPs já criadas manualmente.

Na primeira integração efetiva, o apontamento de consumo real e a confirmação/finalização
continuarão sendo feitos pelo colaborador no Sankhya.

Fontes oficiais consultadas:

- https://developer.sankhya.com.br/reference/guia-integracao
- https://developer.sankhya.com.br/reference/get_v1-produtos
- https://ajuda.sankhya.com.br/hc/pt-br/articles/360045108053-Framework-MES
- https://ajuda.sankhya.com.br/hc/pt-br/articles/360045119313-Ordens-de-Produ%C3%A7%C3%A3o
