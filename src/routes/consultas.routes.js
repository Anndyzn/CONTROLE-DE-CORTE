"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_pg_1 = __importDefault(require("../database-pg"));
const router = (0, express_1.Router)();
router.get("/consultar-cortes", async (req, res) => {
    const { numero, produto, data_inicial, data_final, status } = req.query;
    try {
        let query = `
      SELECT
        c.numero,
        c.produto,
        c.mesa,
        p.data,
        p.status,
        p.folha_parou
      FROM cortes c

      LEFT JOIN LATERAL (
        SELECT
          p2.data,
          p2.status,
          p2.folha_parou
        FROM producao p2
        WHERE p2.numero_corte = c.numero
        ORDER BY p2.id DESC
        LIMIT 1
      ) p ON TRUE

      WHERE 1 = 1
    `;
        const params = [];
        let parametro = 1;
        // NÚMERO DO CORTE
        if (numero) {
            query += ` AND c.numero = $${parametro}`;
            params.push(numero);
            parametro++;
        }
        // NOME / PRODUTO
        if (produto) {
            query += ` AND UPPER(c.produto) LIKE UPPER($${parametro})`;
            params.push(`%${produto}%`);
            parametro++;
        }
        // DATA INICIAL
        if (data_inicial) {
            query += ` AND p.data >= $${parametro}`;
            params.push(data_inicial);
            parametro++;
        }
        // DATA FINAL
        if (data_final) {
            query += ` AND p.data <= $${parametro}`;
            params.push(data_final);
            parametro++;
        }
        // STATUS
        if (status) {
            query += ` AND p.status = $${parametro}`;
            params.push(status);
            parametro++;
        }
        // MAIS RECENTE PRIMEIRO
        query += `
      ORDER BY c.numero DESC
    `;
        const resultado = await database_pg_1.default.query(query, params);
        res.json(resultado.rows);
    }
    catch (erro) {
        console.error("Erro ao consultar cortes:", erro);
        res.status(500).json({
            erro: "Erro ao consultar cortes"
        });
    }
});
exports.default = router;
