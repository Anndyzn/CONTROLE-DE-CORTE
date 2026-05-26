-- =========================================
-- ALTERAR PRODUTO
-- =========================================
UPDATE cortes
SET produto = ' '
WHERE numero = ;

UPDATE cortes
SET numero = 695,
    produto = 'CAPTONE COM FITA'
WHERE numero = 696;

DELETE FROM producao
WHERE numero_corte = 696;


--ALTERAR DATA--
UPDATE producao
SET data = '2026-05-18'
WHERE id IN (5, 6);


-- =========================================
-- ALTERAR MESA
-- =========================================
UPDATE cortes
SET mesa = 'MESA 3'
WHERE numero = ;


-- =========================================
-- ALTERAR STATUS PRODUÇÃO
-- =========================================
UPDATE producao
SET status = 'FINALIZADO'
WHERE numero_corte = ;


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
-- APAGAR ITENS DE UM CORTE
-- =========================================
DELETE FROM itens_corte
WHERE numero_corte = ;