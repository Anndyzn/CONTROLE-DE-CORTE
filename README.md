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

### Backup e testes no GitHub
- Backup local do schema `public`, com SHA-256 e conferência por recuperação em PostgreSQL isolado.
- Rotina diária no Windows, às 8h de Brasília, dependente do computador e do Docker Desktop disponíveis.
- Comandos, requisitos e recuperação protegida: [Backup e recuperação](docs/backup-e-recuperacao.md).
- GitHub Actions executa os testes em Node.js 22/24 e testa uma recuperação real com dados fictícios em PostgreSQL 17, em pushes e pull requests. Não são usadas credenciais de produção no CI.
- Para o Render aguardar os testes, selecione **Settings → Auto-Deploy → After CI Checks Pass** depois de confirmar uma execução verde no GitHub. **On Commit** publica sem esperar esses testes.

### Rascunhos e histórico administrativo
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
