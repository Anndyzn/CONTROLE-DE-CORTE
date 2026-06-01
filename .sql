-----APAGAR DADOS DE CORTE
DELETE FROM producao
WHERE numero_corte IN (1, 2);


UPDATE producao
SET hora_inicio = '14:30'
WHERE id IN (53);


-- =========================================
-- ALTERAR STATUS PRODUÇÃO
-- =========================================
UPDATE itens_corte
SET quantidade_pecas = '1440'
WHERE id IN (42);


-- =========================================
-- APAGAR UM CORTE
-- =========================================
DELETE FROM cortes
WHERE numero = ;


-- =========================================
-- APAGAR PRODUÇÃO DE UM CORTE
-- =========================================
DELETE FROM producao
WHERE numero_corte = ;

-- =========================================
-- APAGAR PRODUÇÃO DE UM CORTE
-- =========================================


