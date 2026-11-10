# 🧵 Sistema de Controle de Corte

Sistema web desenvolvido para otimizar o controle de cortes na produção têxtil, permitindo acompanhar cortes, turnos, apontamentos e consumo de materiais de forma organizada, padronizada e confiável.

---

## 📌 Problemas identificados

Dificuldade em:

- Saber onde cada corte parou
- Garantir continuidade correta entre turnos
- Controlar histórico de produção
- Registrar materiais utilizados no corte
- Evitar erros de planilhas manuais
- Consultar rapidamente cortes finalizados e em andamento
- Controlar perdas, sobras e metragem utilizada
- Centralizar informações da produção em um único sistema

---

## 💡 Solução desenvolvida

Sistema web interno que permite:

- Cadastro de cortes
- Registro de produção por turno
- Continuidade automática entre operadores e turnos
- Histórico completo de produção
- Controle de itens e materiais do corte
- Dashboard resumido do corte
- Consulta avançada de cortes
- Controle de status dos cortes
- Visualização de cortes em andamento em tempo real

---

## ⚙️ Funcionalidades

### Padronização de nomes
- No Admin, **Padronizar nomes** permite selecionar grafias existentes dos nomes dos cortes ou modelos dos PIs e conferir os registros antes de aplicar.
- Exige responsável e motivo, audita cada alteração e recusa prévia desatualizada. Modelos preservam seus vínculos Sankhya por cópia de correspondências, com bloqueio em caso de conflito.
- Produto do novo corte e modelo dos PIs oferecem até cinco sugestões dos nomes existentes, permitindo digitação livre.
- Funcionamento e limites: [Padronização de nomes](docs/padronizacao-nomes.md).

### Histórico no Admin

Na Home, abrir um corte em produção leva ao lançamento e ao próximo campo vazio;
cortes finalizados continuam abrindo os PIs. Formulários de produção e PIs mostram
erros junto aos campos, com foco no primeiro problema. No Sankhya, cada PI informa
Salvando / Salvo ou a falha, restaurando a seleção anterior quando a gravação é recusada.

O histórico no Admin apresenta campos **Antes / Depois**, nomes anteriores e novos,
responsável, motivo e data. Permite filtrar por corte, tipo, período e texto (incluindo
nomenclaturas antigas), com paginação para consultar todo o histórico registrado.
Padronizações feitas juntas aparecem agrupadas, destacando os nomes antigos e o nome
que deve ser usado. Os detalhes preservam cada corte e PI afetado. Grupos continuam
sendo reunidos ao carregar páginas anteriores, indicando a quantidade já exibida.

### Códigos Sankhya

**Salvar e adicionar outro PI** mantém modelo e tecido, limpa cor e valores e foca a
próxima cor. Falhas preservam os dados; cliques duplos não duplicam o envio. Se a pessoa
alterar os campos durante o envio, eles não são apagados depois de salvar.

No Sankhya, **Próximo pendente** consulta a fila atualizada e abre outro corte finalizado
que ainda precisa de lançamento, começando pelo mais antigo. Não marca lançamentos e
aguarda uma gravação em andamento antes de permitir a navegação.

- **Pendentes / Lançados / Todos** acompanham os cortes abertos na primeira ativação e os novos. A fila abre os códigos diretamente, sem formulário de busca. Links antigos para um corte específico continuam funcionando.
- No Admin, **Correções / Nomenclaturas / Histórico** ficam em abas; Nomenclaturas mostra os nomes acompanhados que ainda precisam de produto Sankhya, com atalho para vincular.

- Em **Produtos possíveis por nome do corte**, liste as nomenclaturas existentes e salve alternativas do catálogo Sankhya. Depois escolha a alternativa no PI para preencher os códigos e descrições do ERP; controles e vínculo efetivo são conferidos antes de salvar. A tela Consultar e os registros históricos permanecem como estão.
- Em **PIs cortados**, cada item mostra seus produtos vinculados e um atalho para conferir/cadastrar a correspondência em outra aba. A associação usa modelo do PI, tecido e cor; o nome do corte é apenas uma identificação.
- Vínculos podem ser conferidos em itens antigos e novos, mesmo antes da confirmação dos PIs. Eles não indicam que uma OP já foi lançada no ERP.
- Na Home, **Sankhya** abre a conferência dos itens de cortes finalizados com PIs confirmados.
- Cadastre correspondências por modelo, tecido e cor, com um ou vários produtos e controles do ERP.
- A tela atual mostra somente o produto e seu código para copiar. Uma opção cadastrada aparece automaticamente; conjuntos mostram seus componentes juntos. Excel e editor individual foram retirados da interface.
- Escolha produtos e uma variação por produto no catálogo local fornecido pela equipe. Conjunto feminino e terno carregam seus dois componentes juntos; confira e salve. A lista não é sincronizada com o ERP.
- O guia não importa dados nem cria OPs no Sankhya; apontamento, consumo real e confirmação continuam no ERP.
- Funcionamento e próximos passos: [Integração Sankhya](docs/integracao-sankhya.md).

### Backup e testes no GitHub
- Backup local do schema `public`, com SHA-256 e conferência por recuperação em PostgreSQL isolado.
- Rotina diária no Windows, às 8h de Brasília, dependente do computador e do Docker Desktop disponíveis.
- Comandos, requisitos e recuperação protegida: [Backup e recuperação](docs/backup-e-recuperacao.md).
- GitHub Actions executa os testes em Node.js 22/24 e testa uma recuperação real com dados fictícios em PostgreSQL 17, em pushes e pull requests. Não são usadas credenciais de produção no CI.
- Para o Render aguardar os testes, selecione **Settings → Auto-Deploy → After CI Checks Pass** depois de confirmar uma execução verde no GitHub. **On Commit** publica sem esperar esses testes.

### Rascunhos e histórico administrativo
- No resumo do corte no Admin, **Corrigir produto** permite ajustar somente o nome, sem alterar mesa, número, produção ou PIs. Exige responsável e motivo e registra nome anterior e novo no histórico. Uma correção baseada em nome desatualizado é recusada.
- Os campos do cadastro do corte, da produção e dos PIs são salvos automaticamente neste navegador, separados por corte.
- Ao voltar, use **Restaurar** ou **Descartar** no aviso de rascunho. Restaurar preenche os campos; o envio continua manual.
- Após um envio confirmado, somente o rascunho daquele formulário é removido. Falhas de conexão mantêm o rascunho.
- A restauração consulta o estado atual do corte. Produção com lançamento mais recente, cortes já finalizados e PIs registrados ou alterados não recebem valores antigos automaticamente.
- Rascunhos de `localhost` e do site no Render são separados, assim como navegadores e computadores diferentes.
- Correções, reaberturas e exclusões pedem **responsável** e **motivo**, validados também pelo servidor. Isso inclui correções e exclusões de PIs na tela inicial.
- O responsável é informado pela pessoa; o sistema ainda não autentica sua identidade.
- O Admin oferece um histórico paginado, com filtro por corte, data e hora, motivo e dados anteriores/posteriores. Exclusões completas conservam também os lançamentos e PIs removidos nesse histórico; isso não substitui um backup.
- A tabela `historico_admin` e seu índice são preparados automaticamente na inicialização, sem modificar os registros existentes de cortes, produção ou PIs. A conexão PostgreSQL precisa poder criar a tabela na primeira execução. O acesso direto à tabela pelo cliente Supabase fica bloqueado por RLS; a aplicação usa sua conexão de servidor.
- A alteração principal e o registro no histórico são feitos na mesma transação: se o histórico falhar, a alteração é desfeita.
- O histórico cobre as ações feitas após a instalação desta versão; alterações anteriores não são reconstruídas.

### 📋 Gestão de cortes
- 🔍 Buscar corte
- ➕ Criar novo corte
- 🏷️ Cadastro de produto e mesa
- 📌 Controle de status do corte

### 🏭 Produção
- 👷 Registro por operador e turno
- 🔄 Continuidade automática da última folha
- ⏱️ Controle de horário e duração
- 📊 Histórico completo de apontamentos

### 🧵 Itens do corte
- 📦 Cadastro de modelos
- 🎨 Controle de cores
- 🧶 Controle de tecidos
- 📏 Metragem utilizada
- ♻️ Controle de sobra
- ⚠️ Controle de perda
- 📦 Quantidade de peças produzidas

### 📈 Consultas e dashboard
- **Exportar Excel** baixa um arquivo `.xlsx` com três abas: **Cortes** (resumo e totais), **Produção** e **PIs**. Exporta todos os resultados da última busca, além dos 20 inicialmente visíveis. Os mesmos filtros são aplicados no servidor; datas consideram a última produção de cada corte, como na consulta. As abas de detalhes incluem o histórico completo dos cortes encontrados. O relatório é somente leitura e preserva números, datas e acentos.
- 📊 Dashboard automático do corte
- 📋 Lista de cortes em andamento
- 🔎 Consulta de cortes finalizados
- 📅 Filtros por data e status
- 📑 Histórico detalhado do corte
- 🧾 Visualização dos itens utilizados

### 🛠️ Administração
- ✏️ Reabertura de itens do corte
- 🗑️ Exclusão de itens
- 📝 Edição de itens cadastrados
- 🔒 Bloqueio automático após finalização

---

## 🛠️ Tecnologias utilizadas

### Backend
- Node.js
- Express
- TypeScript

### Banco de dados
- PostgreSQL
- Supabase

### Frontend
- HTML5
- CSS3
- JavaScript

### Infraestrutura
- Docker
- Docker Compose
- Render

---

## 🎯 Objetivo do sistema

Melhorar a organização e rastreabilidade do setor de corte, reduzindo erros operacionais, aumentando a visibilidade da produção e facilitando a tomada de decisão no ambiente fabril.
