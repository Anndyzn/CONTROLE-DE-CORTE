-- =========================================
-- ALTERAR PRODUTO
-- =========================================
UPDATE cortes
SET produto = 'VESTIDO RENDA'
WHERE numero = 686;


-- =========================================
-- ALTERAR MESA
-- =========================================
UPDATE cortes
SET mesa = 'MESA 3'
WHERE numero = 686;


-- =========================================
-- ALTERAR STATUS PRODUÇÃO
-- =========================================
UPDATE producao
SET status = 'FINALIZADO'
WHERE numero_corte = 686;


-- =========================================
-- APAGAR UM CORTE
-- =========================================
DELETE FROM cortes
WHERE numero = 686;


-- =========================================
-- APAGAR PRODUÇÃO DE UM CORTE
-- =========================================
DELETE FROM producao
WHERE numero_corte = 686;


-- =========================================
-- APAGAR ITENS DE UM CORTE
-- =========================================
DELETE FROM itens_corte
WHERE numero_corte = 686;