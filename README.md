# Sistema de Controle de Corte

Controle interno da produção têxtil: cortes, ocupação das mesas, operadores,
turnos, folhas produzidas, consumo e peças cortadas. Também organiza códigos
para facilitar o lançamento manual no Sankhya.

## Uso diário

1. Crie um corte em uma mesa livre, usando as sugestões de nomes existentes.
2. Use **Assumir** para registrar operador, turno e início do trabalho.
3. Ao lançar a produção, confirme o início e informe término real, folha final
   e se o corte continua em produção ou foi finalizado.
4. Após finalizar, cadastre os PIs com modelo, cor, tecido, consumo e quantidade;
   confira os itens e confirme os PIs.
5. No **Sankhya**, confira os produtos, copie os códigos e marque manualmente
   os produtos que já foram lançados no ERP.

O servidor impede valores negativos, folha final menor que a inicial, produção
em cortes finalizados e criação de outro corte em mesa ocupada.

## Recursos por tela

- **Início:** ocupação das mesas, última produção, trabalho iniciado, cortes em
  andamento, busca por número e finalizados de hoje ou até dois dias anteriores.
  O cartão **Cortes finalizados sem PIs** acompanha cortes sem itens cadastrados,
  dentro do marco de acompanhamento; históricos excluídos não geram cobranças retroativas.
- **Produção:** início pendente pode ser corrigido ou cancelado com responsável
  e motivo. Inícios de dias anteriores sem produção lançada aparecem destacados.
- **Rascunhos:** cadastro, produção e PIs podem ser recuperados no mesmo navegador.
  Restaurar não envia dados; o sistema verifica se o estado atual permite a recuperação.
- **Consultar:** filtros mantidos no navegador, histórico e Excel dos resultados
  filtrados, com abas Cortes, Produção e PIs.
- **Sankhya:** fila de pendentes e lançados, vários produtos por PI, componentes
  de conjuntos e cópia de códigos. Produtos podem ser aplicados às outras cores
  do mesmo modelo e tecido, preservando escolhas existentes.
- **Admin:** correções, reaberturas, exclusões, padronização de nomes e nomenclaturas
  sem vínculo. Histórico com antes/depois, responsável e motivo; padronizações
  realizadas juntas aparecem agrupadas.

O lançamento no Sankhya continua manual: este sistema não cria OPs nem movimenta
estoque. O catálogo de códigos é local. Não há autenticação; o responsável nas
alterações é informado pela pessoa.

## Executar localmente

Requisitos: Node.js 22, npm e conexão com o PostgreSQL do projeto provisionado.
O CI também testa o sistema em Node.js 24.

```powershell
npm.cmd ci
Copy-Item .env.example .env
```

Preencha `DATABASE_URL` no `.env` com a conexão autorizada e execute:

```powershell
npm.cmd run dev
```

Acesse **http://localhost:3000**. A porta pode ser definida por `PORT`.
Em outros shells, use `npm` no lugar de `npm.cmd`.
O comando `dev` não reinicia automaticamente após alterações no backend.

O servidor prepara as estruturas auxiliares de histórico, trabalhos e Sankhya.
As tabelas principais `cortes`, `producao` e `itens_corte` precisam existir antes,
em banco provisionado ou restaurado de backup verificado. A conexão precisa
poder preparar as estruturas auxiliares. O arquivo legado `.sql` não é uma
migração completa da versão atual.

Se o `.env` local apontar para produção, gravações locais também alteram os dados
de produção. Use banco separado para experimentos.

Para executar a versão compilada:

```powershell
npm.cmd run build
npm.cmd start
```

## Verificação

```powershell
npm.cmd test
npm.cmd run test:padronizacao
npm.cmd run test:backup
```

- `test`: compila e executa testes unitários e de interface simulada, sem banco real.
- `test:padronizacao`: integração com PostgreSQL 17 descartável, incluindo nomes,
  vínculos, acompanhamento e trabalhos iniciados.
- `test:backup`: testa backup e recuperação com dados fictícios em banco isolado.

Os dois testes de integração exigem Docker disponível. O script manual
`tests/integracao-sankhya-nomes.cjs` verifica planos SQL em transação somente leitura
usando `DATABASE_URL`; não faz parte da suíte automática.
O GitHub Actions executa as verificações em pushes e pull requests, sem credenciais de produção.

### Dependências

Use `npm.cmd ci` para instalar as versões verificadas do `package-lock.json`.
A ferramenta de desenvolvimento é `ts-node`; compilador e tipos ficam nas dependências
de desenvolvimento. O `overrides` do ExcelJS fixa `uuid` em `11.1.1`, versão corrigida
que mantém a API CommonJS usada pela biblioteca. Ao atualizar o ExcelJS, reavalie
esse ajuste e confira a geração e leitura dos arquivos Excel.
Aviso do mantenedor: [correção do uuid](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq).

## Backup e publicação

```powershell
npm.cmd run backup:create
npm.cmd run backup:status
```

Consulte [Backup e recuperação](docs/backup-e-recuperacao.md) para requisitos,
agendamento diário, verificação e restauração protegida. A rotina local depende
do computador disponível. Backups e `.env` não devem ser versionados.

No Render: configure `DATABASE_URL`, build `npm ci && npm run build` e inicialização
`npm start`. O servidor usa a variável `PORT` fornecida pelo ambiente.
**On Commit** publica sem aguardar testes. Para aguardar o GitHub Actions, use
**After CI Checks Pass** após confirmar uma execução verde. Confira o commit no deploy.

A configuração Docker existente é de desenvolvimento. Para subir apenas o app:
`docker compose up --build app`. O serviço opcional `cloudflared` depende de
`CLOUDFLARE_TOKEN` e não é necessário no Render.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `src/server.ts` | Inicialização do Express e das estruturas auxiliares |
| `src/routes/` | Rotas HTTP e validação das operações |
| `src/services/` | Regras compartilhadas, transações e histórico |
| `src/public/` | HTML, CSS, JavaScript e catálogo local Sankhya |
| `scripts/` | Backup, recuperação e agendamento |
| `tests/` | Testes unitários e integrações isoladas |
| `docs/` | Procedimentos e documentação funcional |
| `.github/workflows/` | Verificação automática no GitHub |

Backend: Node.js, Express e TypeScript. Banco: PostgreSQL/Supabase.
Frontend: HTML, CSS e JavaScript com módulos.

## Documentação complementar

- [Padronização de nomes](docs/padronizacao-nomes.md)
- [Apoio ao lançamento no Sankhya](docs/integracao-sankhya.md)
- [Backup e recuperação](docs/backup-e-recuperacao.md)
