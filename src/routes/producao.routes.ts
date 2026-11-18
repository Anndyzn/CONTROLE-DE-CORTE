import { Router } from "express"
import dbPg from "../database-pg"
import { numeroCorteValido, validarProducao } from "../utils/validacoes"
import { ErroRegra, executarNoCorte } from "../services/corte-bloqueado"
import { executarAlteracaoProducao } from "../services/alteracao-producao"
import { ErroMesaOcupada } from "../services/mesa-disponivel"
import { conferirDuplicidadeProducao, ErroProducaoSemelhante } from "../services/duplicidade-producao"
import { conferirInicioReal } from "../services/trabalho-corte"

const router = Router()

router.post("/producao", async (req, res) => {
  const erroValidacao = validarProducao(req.body ?? {})
  if (erroValidacao) return res.status(400).json({ erro: erroValidacao })
  if (!numeroCorteValido(req.body.numero_corte)) {
    return res.status(400).json({ erro: "Informe um número de corte válido." })
  }

  const {
    data,
    numero_corte,
    turno,
    operador,
    folha_inicio,
    folha_parou,
    status,
    hora_inicio,
    hora_fim
  } = req.body

  try {
    const resultado = await executarNoCorte(Number(numero_corte), async (client, corte) => {
      let trabalhoId:number|null=null
      let inicioReal:Date|null=null
      if(req.body.trabalho_id!==undefined){
        if(!numeroCorteValido(req.body.trabalho_id))throw new ErroRegra(400,"Trabalho inválido.")
        const consulta=await client.query(`SELECT *,TO_CHAR(data_trabalho,'YYYY-MM-DD') AS dia,
          TO_CHAR(COALESCE(inicio_real_em,iniciado_em) AT TIME ZONE 'America/Sao_Paulo','HH24:MI') AS inicio
          FROM trabalhos_corte WHERE id=$1 AND numero_corte=$2 FOR UPDATE`,[req.body.trabalho_id,numero_corte])
        const t=consulta.rows[0]
        if(!t)throw new ErroRegra(404,"Trabalho não encontrado neste corte.")
        if(t.status!=="EM_TRABALHO")throw new ErroRegra(412,"Este trabalho já foi lançado. Atualize o corte.")
        if(req.body.corrigir_inicio===true)inicioReal=await conferirInicioReal(client,{data,hora_inicio})
        if((!inicioReal&&(data!==t.dia||hora_inicio!==t.inicio))||turno!==t.turno||operador!==t.operador||!hora_fim)throw new ErroRegra(400,"Mantenha os dados do início registrado ou informe o início real, e preencha a hora do término.")
        const base=await client.query("SELECT id,folha_parou FROM producao WHERE numero_corte=$1 ORDER BY id DESC LIMIT 1",[numero_corte])
        if(String(req.body.producao_base_id??"")!==String(base.rows[0]?.id??"")||Number(folha_inicio)!==Number(base.rows[0]?.folha_parou??0))throw new ErroRegra(412,"A produção deste corte mudou. Selecione novamente o trabalho para conferir a folha inicial.")
        trabalhoId=Number(t.id)
      }
      const ultima = await client.query(
        "SELECT status FROM producao WHERE numero_corte = $1 ORDER BY id DESC LIMIT 1",
        [Number(numero_corte)]
      )

      if (ultima.rows[0]?.status === "FINALIZADO" || Number(corte.itens_finalizados) === 1) {
        throw new ErroRegra(409, "Este corte já está finalizado. Novos lançamentos de produção estão bloqueados.")
      }

      if(status==="FINALIZADO"){
        const pendentes=await client.query("SELECT id FROM trabalhos_corte WHERE numero_corte=$1 AND status='EM_TRABALHO' AND ($2::bigint IS NULL OR id<>$2) LIMIT 1",[numero_corte,trabalhoId])
        if(pendentes.rows.length)throw new ErroRegra(412,"Há outro início de trabalho sem produção lançada. Conclua esse lançamento antes de finalizar o corte.")
      }
      await conferirDuplicidadeProducao(client,req.body,req.body.confirmacao_duplicidade)

      const inserida = await client.query(
        `
        INSERT INTO producao (
          data, numero_corte, turno, operador, folha_inicio,
          folha_parou, status, hora_inicio, hora_fim
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          data, Number(numero_corte), turno, operador,
          Number(folha_inicio), Number(folha_parou), status,
          hora_inicio || null, hora_fim || null
        ]
      )
      if(trabalhoId!==null)await client.query(`UPDATE trabalhos_corte SET status='LANCADO',producao_id=$1,
        inicio_real_em=COALESCE($3,inicio_real_em),data_trabalho=$4::date WHERE id=$2`,[inserida.rows[0].id,trabalhoId,inicioReal,data])
      return inserida
    })

    res.status(201).json({
      mensagem: "Produção salva com sucesso",
      id: resultado.rows[0].id
    })
  } catch (erro) {
    if(erro instanceof ErroProducaoSemelhante)return res.status(409).json({
      erro:erro.message,codigo:"PRODUCAO_SEMELHANTE",registros:erro.registros,confirmacao:erro.confirmacao
    })
    if (erro instanceof ErroRegra) return res.status(erro.status).json({ erro: erro.message })
    console.error(erro)

    res.status(500).json({
      erro: "Erro ao salvar produção"
    })
  }
})

router.get("/producao/:numero/ultima", async (req, res) => {
  const { numero } = req.params

  try {
    const resultado = await dbPg.query(
      `
      SELECT *
      FROM producao
      WHERE numero_corte = $1
      ORDER BY id DESC
      LIMIT 1
      `,
      [numero]
    )

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Nenhuma produção encontrada para este corte"
      })
    }

    res.json(resultado.rows[0])
  } catch (erro) {
    console.error(erro)

    res.status(500).json({
      erro: "Erro ao buscar última produção"
    })
  }
})

router.get("/producao/:numero", async (req, res) => {
  const { numero } = req.params

  try {
    const resultado = await dbPg.query(
      `
      SELECT *
      FROM producao
      WHERE numero_corte = $1
      ORDER BY data ASC, hora_inicio ASC
      `,
      [numero]
    )

    res.json(resultado.rows)
  } catch (erro) {
    console.error(erro)

    res.status(500).json({
      erro: "Erro ao buscar histórico do corte"
    })
  }
})

router.get("/producao", async (req, res) => {
  try {
    const resultado = await dbPg.query(
      `
      SELECT *
      FROM producao
      ORDER BY id DESC
      `
    )

    res.json(resultado.rows)
  } catch (erro) {
    console.error(erro)

    res.status(500).json({
      erro: "Erro ao buscar produção"
    })
  }
})

// ========================================
// EDITAR LANÇAMENTO DE PRODUÇÃO
// ========================================

router.put("/producao/:id", async (req, res) => {
  const erroValidacao = validarProducao(req.body ?? {})
  if (erroValidacao) return res.status(400).json({ erro: erroValidacao })

  const { id } = req.params

  const {
    data,
    turno,
    operador,
    folha_inicio,
    folha_parou,
    status,
    hora_inicio,
    hora_fim
  } = req.body


  try {
    const resultado = await executarAlteracaoProducao(id, status, req.body, client => client.query(
      `
      UPDATE producao
      SET
        data = $1,
        turno = $2,
        operador = $3,
        folha_inicio = $4,
        folha_parou = $5,
        status = $6,
        hora_inicio = $7,
        hora_fim = $8
      WHERE id = $9
      RETURNING *
      `,
      [
        data,
        turno,
        operador,
        Number(folha_inicio),
        Number(folha_parou),
        status,
        hora_inicio || null,
        hora_fim || null,
        id
      ]
    ))


    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Lançamento de produção não encontrado"
      })
    }


    res.json({
      mensagem:
        "Lançamento atualizado com sucesso",

      producao:
        resultado.rows[0]
    })

  } catch (erro) {
    if (erro instanceof ErroMesaOcupada) {
      return res.status(409).json({ erro: erro.message, codigo: "MESA_OCUPADA", mesa: erro.mesa, cortes: erro.cortes })
    }
    if (erro instanceof ErroRegra) return res.status(erro.status).json({ erro: erro.message })
    console.error(
      "Erro ao atualizar produção:",
      erro
    )

    res.status(500).json({
      erro:
        "Erro ao atualizar lançamento de produção"
    })
  }
})

// ========================================
// EXCLUIR LANÇAMENTO DE PRODUÇÃO
// ========================================

router.delete(
  "/producao/:id",
  async (req, res) => {

    const { id } =
      req.params

    try {

      const resultado =
        await executarAlteracaoProducao(id, null, req.body, client => client.query(
          `
          DELETE FROM producao
          WHERE id = $1
          RETURNING *
          `,
          [id]
        ))


      // ========================================
      // PRODUÇÃO NÃO ENCONTRADA
      // ========================================

      if (
        resultado.rows.length === 0
      ) {
        return res
          .status(404)
          .json({
            erro:
              "Lançamento de produção não encontrado"
          })
      }


      // ========================================
      // SUCESSO
      // ========================================

      res.json({
        mensagem:
          "Lançamento excluído com sucesso",

        producao:
          resultado.rows[0]
      })

    } catch (erro) {
      if (erro instanceof ErroMesaOcupada) {
        return res.status(409).json({ erro: erro.message, codigo: "MESA_OCUPADA", mesa: erro.mesa, cortes: erro.cortes })
      }
      if (erro instanceof ErroRegra) return res.status(erro.status).json({ erro: erro.message })

      console.error(
        "Erro ao excluir produção:",
        erro
      )


      res
        .status(500)
        .json({
          erro:
            "Erro ao excluir lançamento de produção"
        })
    }
  }
)

export default router
