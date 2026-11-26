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

A navegação usa um menu lateral que pode ser recolhido e lembra a preferência neste
navegador. Na Home, a busca fica compacta acima das mesas. Abrir um corte destaca a
área de lançamento; **Voltar às mesas** e **Continuar corte** alternam a visualização
sem limpar os campos ou o corte selecionado, recuperando a posição de rolagem.
No corte, a barra de atalhos leva a Produção, PIs e Histórico. Os painéis de andamento,
finalizados e PIs pendentes lembram se foram deixados abertos ou recolhidos neste
navegador. As animações respeitam a preferência por movimento reduzido do computador.
As mesas destacam **Assumir hoje** ou **Concluir trabalho**, conforme o início pendente.
O cartão do corte indica o próximo passo; o início confirmado aparece resumido e
as correções ficam em **Editar início**, mantendo os campos finais em preenchimento.
Junto a **Salvar produção**, um resumo acompanha o preenchimento com operador,
mesa, horários, data, turno, folhas e situação, indicando término no dia seguinte
quando atravessa a meia-noite. O resumo não altera os dados nem substitui as validações.
Ao assumir, o último operador e turno registrados com sucesso neste navegador são
sugeridos para conferência. Datas e horários reais não são reaproveitados.
De segunda a sexta, às 06h e às 07h30 de Brasília, lembretes na tela oferecem **Ver mesas**.
Eles também aparecem ao abrir ou retomar o sistema na hora seguinte ao início de cada
turno (06h–07h e 07h30–08h30). Fechar um não dispensa o outro. Cada lembrete pode ser
fechado até o próximo dia útil neste navegador. Depende de o sistema estar aberto; não é
uma notificação do Windows. A preferência é compartilhada entre abas deste navegador.
Nas tabelas, quantidades e metragens ficam alinhadas à direita; nomes longos quebram
linha e os cabeçalhos acompanham a rolagem. Atualizações preservam a lista visível
quando o contexto continua o mesmo, com aviso explícito se forem mantidos dados
anteriores por falha na consulta. Trocar a aba de tecidos limpa as ações da aba anterior.
Leituras independentes de histórico, PIs, resumo e catálogo são iniciadas em paralelo.
Requisições GET simultâneas para o mesmo endereço compartilham a rede, com objetos
separados para cada consumidor; não há cache persistente de resultados, e gravações
invalidam o compartilhamento anterior. A Consulta mantém detalhes, paginação e filtros
aplicados durante atualizações em segundo plano. A biblioteca de tempo real carrega
separadamente, sem bloquear a abertura da Home e da Consulta. No Sankhya, uma falha
ao carregar o corte oferece **Tentar novamente**.
O menu horizontal original permanece disponível se o módulo de
layout não carregar.

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
- **Tecidos com defeito:** uma peça ou rolo por registro, com NF, tecido, cor opcional,
  metros, um ou mais defeitos e observação. Pendentes podem ser impressos em A4 paisagem.
  Resolver mantém o registro em Resolvidos; reabrir devolve às pendências. O histórico
  de atendimento é preservado no banco, incluindo observações de resoluções anteriores.
  A lista acompanha cadastros e atendimentos de outras abas por eventos do servidor,
  com reconexão e conferência automática a cada 15 segundos. Atualizações preservam
  os campos preenchidos, filtros e atendimento aberto. Ao fechar o atendimento,
  as mudanças pendentes são carregadas. O indicador no cabeçalho mostra a conexão.
  **Excluir**, ao lado de Resolver/Reabrir, pede confirmação e retira somente aquela
  peça das listas, totais e impressão. O registro e seu histórico ficam preservados
  no banco com data de exclusão; a alteração também é avisada às outras telas.
  Marque até 200 peças pendentes e use **Resolver selecionadas** para aplicar uma
  observação comum. O cabeçalho marca somente a página atual; a seleção permanece
  ao paginar e é limpa ao mudar filtros/abas ou clicar em Atualizar. O servidor
  confere todas as versões antes de atender: um conflito ou falha desfaz o lote inteiro.

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
npm.cmd run test:tecidos
```

- `test`: compila e executa testes unitários e de interface simulada, sem banco real.
- `test:padronizacao`: integração com PostgreSQL 17 descartável, incluindo nomes,
  vínculos, acompanhamento e trabalhos iniciados.
- `test:backup`: testa backup e recuperação com dados fictícios em banco isolado.
- `test:tecidos`: testa cadastro, reenvio, concorrência, resolução, reabertura e
  impressão dos tecidos em PostgreSQL descartável; também exige Docker disponível.

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
