# Códigos Sankhya

## Interface atual simplificada

Cada cor permite marcar vários produtos. As escolhas ficam salvas por PI.
Ao lado de cada código há **Lançado no Sankhya**, marcado manualmente após o lançamento
no ERP. Copiar o código não marca o lançamento. É possível desmarcar; um produto marcado
precisa ser desmarcado antes de removê-lo da seleção. Falha ao salvar restaura o estado
anterior, e conflito entre telas exige consultar novamente.

As marcações ficam em `public.sankhya_lancamentos`, com versão, RLS e referência ao PI
com exclusão em cascata. O backup completo do schema public inclui essa tabela.
Alterações no modelo, cor, tecido, quantidade ou metragem invalidam as marcações antigas
até nova conferência. São registros manuais do nosso controle, sem consulta ao ERP.

Escolha o corte e copie o código do produto mostrado. Conjuntos apresentam os códigos
de seus componentes juntos. Havendo alternativas, selecione o que foi cortado.
O cadastro fica recolhido em **Configurar vínculos — manutenção**.

O Excel, a conferência de OPs e o editor individual foram removidos da interface.
Não é necessário carregar produto, salvar correspondência ou confirmar uma OP para
copiar códigos. A consulta não grava dados nem envia informações ao ERP.

As seções seguintes documentam também estruturas e rotas anteriores mantidas no
servidor por compatibilidade. Os procedimentos antigos de Excel e editor não estão
disponíveis na tela atual. Os registros e vínculos antigos foram preservados.

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

### Possibilidades por nomenclatura do corte

No uso diário, basta consultar o corte. A área **Produtos para lançar no Sankhya** mostra
automaticamente os códigos: um vínculo específico existente do PI tem prioridade;
caso contrário, uma única possibilidade da nomenclatura aparece diretamente. Com várias
alternativas, a pessoa escolhe qual foi cortada. Grupos mostram seus componentes juntos.
O botão copia somente o código, sem gravar correspondências ou criar OPs. Essa visualização
não estima consumo, não define controles e não representa lançamento confirmado no ERP.

**Configurar vínculos — manutenção** e **Ajustes individuais e guia em Excel** ficam
recolhidos abaixo. São uma separação visual, sem autenticação ou restrição de acesso.

Na tela Sankhya, abra **Configurar vínculos — manutenção**. A lista lê os nomes de
`cortes.produto`, agrupados por espaços e maiúsculas. Busque e selecione a nomenclatura,
adicione os produtos ou grupos que podem sair dela e salve. Exemplo: EDREDON LISO INFERIOR
pode ter a opção **6086 — PI CORTE EDREDON INF**. Cada opção é uma alternativa; um grupo
como conjunto feminino mantém blazer e vestido dentro da mesma opção.

Ao preparar um PI, **O que saiu deste corte?** mostra as possibilidades do nome do corte.
Escolher **Usar opção selecionada** preenche código e descrição oficiais do catálogo,
sem gravar automaticamente. Confira controles e salve a correspondência do PI. A cor é
definida nesta etapa; o cadastro de possibilidades não inclui todas as cores como OPs.
Um produto fora das opções ainda pode ser escolhido pelo editor existente.

As possibilidades ficam em `public.sankhya_nomes`, com versão e RLS. Não renomeiam cortes,
não alteram a tela Consultar, nem modificam correspondências de PIs já salvas. São um
atalho para escolher destinos; a correspondência efetiva continua por modelo, tecido e cor.
O backup completo do schema public abrange esta tabela. Nenhuma associação é criada
automaticamente: a equipe deve informar os produtos de cada nomenclatura.

Na Home, cada item em **PIs cortados** mostra sua situação de vínculo com o Sankhya.
O nome do corte é somente uma identificação; a correspondência usa **modelo do PI,
tecido e cor**, sem vincular pelo nome do corte. Isso vale para itens antigos e novos.
O indicador distingue vínculo cadastrado, vínculo pendente e falha de consulta; não informa
se uma OP já foi lançada no ERP. Os nomes e códigos vinculados podem ser expandidos no próprio PI.

Use **Conferir vínculo** ou **Vincular produtos** no item para abrir a tela Sankhya em outra
aba, já com o corte e o PI selecionados. Ao voltar para a Home, os vínculos são consultados novamente.
Também é possível abrir **Sankhya** pelo cabeçalho e digitar o número do corte.
Vínculos podem ser cadastrados antes da confirmação dos PIs. O Excel continua exigindo
produção finalizada, PIs confirmados e correspondências completas.

A lista traz até 50 cortes recentes; números mais antigos podem ser digitados. Esses cortes
são candidatos à conferência: o sistema ainda não sabe quais foram lançados manualmente no ERP.

Selecione cada item e escolha os produtos de destino no catálogo fornecido pela equipe.
A descrição é preenchida pelo código. Escolha somente o controle efetivamente cortado:
cor, medida, tamanho ou parte, conforme o produto. As correspondências são compartilhadas pelos
cortes com o mesmo modelo, tecido e cor, normalizados por espaços e letras maiúsculas.
Produtos cadastrados sem controle ficam com o campo vazio; nos demais, a escolha é obrigatória.
O campo vazio será armazenado e apresentado como **Sem controle** na
conferência e no Excel; essa indicação não deve ser digitada no ERP. A cor do PI de origem
continua preservada e faz parte da identificação da correspondência.
Acentos e grafias diferentes continuam separados. A edição usa versão para impedir
sobrescrever uma alteração feita por outra tela.

Um item pode corresponder a até dez produtos. Por exemplo, conjunto feminino branco,
216 unidades, pode gerar uma linha para blazer branco (216) e outra para vestido branco
(216). Cada linha representa uma OP prevista; não são agregadas linhas de itens distintos.
Essa relação de quantidade 1:1 por destino precisa ser conferida antes de usar o resultado.

Os atalhos **Conjunto feminino** (6073 blazer + 6069 vestido) e **Terno masculino**
(6074 blazer + 26 calça) carregam os dois componentes com uma única variação escolhida.
Há também grupos separados para ternos risca de giz e mescla. A lista do grupo oferece
somente controles existentes nos dois componentes. Confira e salve o vínculo após carregar.
Por exemplo, 100 conjuntos brancos resultam em 100 blazers brancos e 100 vestidos brancos,
sem incluir as outras cores disponíveis. Outras variações devem estar em PIs separados.

O catálogo local está em `src/public/data/sankhya-produtos.json`, com a lista fornecida em
09/11/2026. Não há consulta ao cadastro atual do ERP: alterações no Sankhya exigem atualizar
essa lista. Vínculos antigos com várias variações do mesmo produto ou controles inválidos
exigem revisão e bloqueiam o guia. Nenhum histórico é corrigido automaticamente.
Nenhuma correspondência de exemplo é instalada automaticamente.
O consumo total permanece no item original: a preparação não o divide nem o replica
nas OPs. Quantidades zero ou fracionadas impedem preparar a linha, sem alterar o item original.

## Persistência e execução

### Atalhos na tela

- **Copiar vínculo deste PI** guarda os códigos dos componentes somente na aba atual.
  Selecione outro PI e use **Usar produtos copiados**. A quantidade continua sendo a do
  novo PI. O controle é sugerido somente quando corresponde à cor do novo PI no catálogo;
  nos outros casos, escolha a variação antes de salvar. A cor anterior não é transportada.
- Na conferência, **Copiar** copia separadamente código, controle ou quantidade para colar
  no campo correspondente do ERP. **Copiar todas as OPs** reúne as linhas em texto com
  tabulações, adequado para colar em uma planilha. Não é importação ou preenchimento automático.
- A cópia para lançamento, assim como o Excel, exige corte finalizado, PIs confirmados e
  vínculos completos e salvos. Somente as variações dos PIs entram na lista, não todos os
  controles disponíveis no catálogo. Se o navegador bloquear a área de transferência,
  a tela oferece o texto para seleção e cópia manual.

Ao iniciar (`npm.cmd run dev`, ou `npm.cmd start` depois de `npm.cmd run build`), o servidor
prepara a tabela `public.sankhya_correspondencias`, com chave modelo/tecido/cor, destinos JSONB,
versão e data da última alteração. A criação usa transação e bloqueio de migração, e habilita RLS
para impedir acesso direto pelos clientes Supabase. Usa a conexão de servidor já existente.
Não modifica tabelas ou registros de cortes, produção e itens.

O backup do schema `public` abrange também a nova tabela nos próximos backups.

Rotas locais:

- `GET /sankhya/nomenclaturas?busca=...` (ou `nome=...`): nomes dos cortes e opções cadastradas.
- `PUT /sankhya/nomenclaturas`: salva alternativas por nome, com versão otimista.
- `GET /sankhya/catalogo`: produtos, controles e grupos do catálogo local.
- `GET /sankhya/cortes`: candidatos recentes à conferência.
- `GET /sankhya/cortes/:numero/conferencia`: leitura consistente dos itens e das correspondências.
- `GET /sankhya/cortes/:numero/vinculos`: leitura dos vínculos, inclusive com PIs abertos; informa separadamente se o guia está disponível.
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
