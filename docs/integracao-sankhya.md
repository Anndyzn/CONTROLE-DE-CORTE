# Apoio ao lançamento no Sankhya

A tela mostra códigos e nomes dos produtos cortados para facilitar o lançamento
manual no ERP. Não usa credenciais de API, não cria OPs e não movimenta estoque.
Composição, consumo real, apontamento e finalização continuam no Sankhya.

## Uso diário

1. Abra **Sankhya** e escolha um corte na fila.
2. Confira os produtos dos PIs. Uma opção cadastrada aparece diretamente;
   havendo alternativas, selecione o que foi cortado. Cada PI permite vários produtos.
3. Use **Copiar código** e confira cor/controle e quantidade antes de lançar no ERP.
4. Marque **Lançado no Sankhya** após fazer o lançamento.
5. Use **Próximo pendente** para seguir pela fila atualizada.

Copiar não marca como lançado. As marcações são manuais e não comprovam a existência
de uma OP no ERP. É possível desmarcar; um produto marcado precisa ser desmarcado
antes de removê-lo da seleção. Alterar dados relevantes do PI invalida marcações
anteriores e exige nova conferência.

## Manutenção dos vínculos

Abra **Produtos possíveis por nome do corte**, escolha a nomenclatura existente,
adicione produtos ou grupos do catálogo e salve as opções. Exemplo:

**EDREDON LISO INFERIOR → 6086 — PI CORTE EDREDON INF**.

Cada opção é uma alternativa. Grupos podem reunir componentes, como blazer e vestido.
Isso não renomeia os cortes nem modifica a tela Consultar. Cadastrar uma opção não
gera linhas para todas as cores; considere somente a cor efetivamente cortada.

Vínculos específicos existentes têm prioridade. Produtos também podem ser reutilizados
entre cores do mesmo modelo e tecido quando não há alternativas conflitantes.
Grafias diferentes devem ser conferidas e padronizadas no Admin.

**Aplicar produtos às outras cores** replica os códigos escolhidos para outros PIs
do mesmo corte, modelo e tecido, de outra cor e sem escolha/vínculo existente.
Exige confirmação e preserva escolhas anteriores. Não copia controles, consumo,
quantidades nem marcações de lançamento. Dados desatualizados são recusados.

Na Home, os PIs mostram produtos vinculados e atalhos para consultar os vínculos.
Ter vínculo é diferente de já ter lançado no ERP. No Admin, **Nomenclaturas** mostra
nomes acompanhados que ainda precisam de vínculo.

O catálogo está em `src/public/data/sankhya-produtos.json`, fornecido pela equipe.
Não há sincronização com o ERP; mudanças exigem atualizar a lista e conferir vínculos.

## Acompanhamento

**Pendentes / Lançados / Todos** consideram os cortes acompanhados. Na primeira
ativação, o sistema inclui os cortes ainda abertos e passa a incluir os novos.
Antigos já finalizados ficam fora; reiniciar não recalcula o marco.

Um corte aparece como lançado quando está finalizado, tem PIs confirmados,
produtos definidos e todos marcados. Cortes acompanhados permanecem após finalizar.
Links `sankhya.html?corte=NUMERO` abrem cortes específicos, inclusive antigos,
sem incluí-los automaticamente no acompanhamento.

Na Home, **Cortes finalizados sem PIs** é um aviso separado: mostra cortes acompanhados
com produção finalizada e sem itens cadastrados. Não interfere na liberação da mesa.

## Persistência e compatibilidade

As tabelas auxiliares são preparadas na inicialização e usam controle de versão para
recusar gravações desatualizadas. RLS bloqueia acesso direto pelo cliente Supabase;
a aplicação utiliza sua conexão de servidor. O backup de `public` inclui as estruturas.

| Estrutura | Finalidade |
| --- | --- |
| `sankhya_nomes` | Opções por nomenclatura do corte |
| `sankhya_correspondencias` | Correspondências por modelo, tecido e cor |
| `sankhya_lancamentos` | Marcações manuais de lançamento |
| `sankhya_acompanhamento` e `sankhya_acompanhamento_inicio` | Cortes acompanhados e marco inicial |

O editor individual de controles, a conferência de OPs e o guia Excel foram retirados
da interface. As rotas antigas de conferência, correspondências e Excel permanecem
no servidor por compatibilidade. O Excel da tela Consultar continua disponível.

`npm.cmd run test:padronizacao` verifica vínculos, concorrência e acompanhamento em
PostgreSQL descartável, sem usar dados de produção.
