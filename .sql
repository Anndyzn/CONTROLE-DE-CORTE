-----APAGAR DADOS DE CORTE
DELETE FROM producao
WHERE numero_corte IN (1, 2);

-- =========================================
-- ALTERAR STATUS PRODUÇÃO
-- =========================================
UPDATE producao
SET folha_parou = 50
WHERE id IN (75);

SELECT * FROM cortes
WHERE produto LIKE '%MANATA%';

SELECT * FROM itens_corte
WHERE modelo LIKE '%MANATA%';




---- atualizando 2 juntos----
UPDATE producao
SET
    folha_inicio = 100,
    folha_parou = 129
WHERE id IN (58);

UPDATE cortes
SET produto = REPLACE(produto, 'MANATA', 'MANTA');

UPDATE itens_corte
SET modelo = REPLACE(modelo, 'MANATA', 'MANTA');

-- =========================================
-- APAGAR PRODUÇÃO DE UM CORTE
-- =========================================
DELETE FROM producao
WHERE numero_corte = ;

-- =========================================
-- APAGAR PRODUÇÃO DE UM CORTE
-- =========================================

INSERT INTO producao (
    data,
    numero_corte,
    turno,
    operador,
    folha_inicio,
    folha_parou,
    status,
    hora_inicio,
    hora_fim
)
VALUES (
    '2026-05-29',
    711,
    '2º TURNO',
    'GUSTAVO',
    35,
    129,
    'EM PRODUÇÃO',
    '13:45',
    '21:55'
);

