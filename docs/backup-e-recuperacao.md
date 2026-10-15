# Backup local e recuperação

A rotina exporta o schema `public` do PostgreSQL, incluindo estrutura, dados, sequências, índices, restrições e RLS. Isso cobre `cortes`, `producao`, `itens_corte` e `historico_admin`. Não inclui os schemas internos de autenticação/Storage do Supabase, arquivos do Storage, `.env`, configurações do Render ou rascunhos dos navegadores.

As cópias ficam em `backup/`, fora do Git. Cada cópia tem um arquivo `.dump` e um manifesto `.dump.json`; guarde os dois juntos. O manifesto registra data, versão do PostgreSQL, SHA-256 e contagens das tabelas no mesmo snapshot do dump. Não contém senhas nem a URL do banco.

O PostgreSQL continua disponível durante a leitura. Não altere a estrutura das tabelas enquanto um backup estiver em execução.

## Requisitos

- Node.js e dependências instaladas com `npm ci`.
- `.env` com `DATABASE_URL`; opcionalmente `BACKUP_DATABASE_URL` para a conexão direta ou Session Pooler, porta 5432. O Transaction Pooler, porta 6543, é recusado.
- Docker Desktop aberto para a recuperação isolada. As ferramentas de backup também usam Docker quando `pg_dump` não está instalado no Windows. A primeira execução baixa a imagem oficial `postgres` da versão necessária.
- Alternativamente, `PG_BIN_DIR` aponta para as ferramentas PostgreSQL nativas. O cliente `pg_dump` deve ser compatível com a versão do servidor. A verificação isolada continua usando Docker.

No PowerShell, use `npm.cmd` se a política do Windows bloquear `npm.ps1`.

## Criar e conferir uma cópia

```powershell
npm.cmd run backup:create
npm.cmd run backup:verify
npm.cmd run backup:status
```

`backup:verify` confere o hash, restaura a última cópia em um PostgreSQL temporário sem acesso à rede e compara as contagens. O container de conferência é removido ao terminar. O banco em uso não recebe registros de teste.

Para conferir uma cópia específica:

```powershell
npm.cmd run backup:verify -- --file "backup/NOME-DA-COPIA.dump"
```

Para criar e conferir na mesma execução:

```powershell
npm.cmd run backup:daily
```

Falhas retornam código de saída diferente de zero. Na rotina diária, `backup/rotina.log` registra o resultado. Uma cópia sem conferência bem-sucedida permanece com `verificadoEm: null` no manifesto.

## Agendamento no Windows

```powershell
npm.cmd run backup:schedule -- --hora 08:00
```

A tarefa **Dimepor - Backup Controle de Corte** executa diariamente às **8h de Brasília**, com a janela oculta. O instalador confere o fuso do Windows e recusa substituir uma tarefa já existente. Para mudar a configuração, revise a tarefa no Agendador de Tarefas do Windows.

O computador precisa estar ligado, seu usuário precisa estar conectado e o Docker Desktop disponível. Uma execução perdida é tentada quando o Windows disponibiliza a tarefa; falhas têm três novas tentativas, a cada 15 minutos. As cópias datadas são mantidas na pasta, sem limpeza automática de arquivos antigos. Se mover o projeto ou o Node.js, atualize o caminho da tarefa.

Esta é uma cópia local: para cobrir a perda do computador, mantenha futuramente outra cópia em um local separado e protegido.

## Recuperar em um banco separado

1. Escolha uma cópia e seu manifesto, preferencialmente com conferência recente. Execute `backup:verify` antes de usar a cópia.
2. Prepare um destino PostgreSQL da mesma versão principal ou mais recente, com o schema `public` vazio. Mantenha esse destino sem conexões da aplicação durante a recuperação.
3. Configure `RESTORE_DATABASE_URL` localmente no `.env`. Preserve `DATABASE_URL` apontando para o banco em uso: ela é usada para impedir a recuperação acidental nele.
4. Execute:

```powershell
npm.cmd run backup:restore -- --file "backup/NOME-DA-COPIA.dump" --confirm RESTAURAR-BANCO-VAZIO
```

O comando valida o hash, recusa o banco de origem e o banco em uso — inclusive aliases direto/Pooler do mesmo projeto Supabase — e bloqueia destinos com objetos em `public`. A importação usa uma transação e para em qualquer erro. Depois, confere as quantidades de registros.

Papéis referenciados pelas políticas RLS são registrados no manifesto. Quando faltam no destino, são preparados sem login e sem privilégios administrativos; papéis já existentes não são alterados. Senhas, membros de papéis e permissões de plataforma não são exportados. Para voltar a operar no Supabase, confira também as permissões e o acesso em tempo real do projeto de destino.

Para recuperar em um PostgreSQL local próprio, configure as ferramentas nativas em `PG_BIN_DIR`. O comando `backup:verify` já oferece o teste local descartável pelo Docker.

5. Confira cortes, produção, PIs, histórico e um cadastro em ambiente de teste. Ao planejar uma troca definitiva, considere que os lançamentos posteriores à data da cópia não estarão nela. Pause os lançamentos e faça uma nova cópia do estado atual antes de alterar a conexão do serviço.

O procedimento não faz troca automática de `DATABASE_URL` no Render nem restauração sobre produção. A escolha e a troca definitiva do destino devem ser feitas depois da conferência.

## Testes automáticos

```powershell
npm.cmd test
npm.cmd run test:backup
```

A integração usa somente dados fictícios em containers locais descartáveis. Ela confere valores, chaves estrangeiras, sequências e RLS após recuperar um dump real. Os testes do GitHub não usam as credenciais nem os dados do banco da empresa.

Referências: [Supabase: backups](https://supabase.com/docs/guides/platform/backups), [PostgreSQL: pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html), [PostgreSQL: pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html).
