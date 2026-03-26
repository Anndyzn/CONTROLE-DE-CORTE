import express from "express"
import db from "./database"
import path from "path"

const app = express()

app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

app.post("/cortes", (req, res) => {
  const { numero, produto, mesa } = req.body

  db.run(
    "INSERT INTO cortes (numero, produto, mesa) VALUES (?, ?, ?)",
    [numero, produto, mesa],
    function (err) {
      if (err) {
        console.error(err)
        return res.status(500).json({ erro: "Erro ao cadastrar corte" })
      }

      res.json({
        mensagem: "Corte cadastrado com sucesso",
        corte: {
          id: this.lastID,
          numero,
          produto,
          mesa
        }
      })
    }
  )
})

app.get("/cortes/:numero/resumo", (req, res) => {
  const { numero } = req.params

  db.get(
    "SELECT * FROM cortes WHERE numero = ?",
    [numero],
    (err, corte) => {
      if (err) {
        console.error(err)
        return res.status(500).json({ erro: "Erro ao buscar corte" })
      }

      if (!corte) {
        return res.status(404).json({ erro: "Corte não encontrado" })
      }

      db.get(
        `SELECT * FROM producao
         WHERE numero_corte = ?
         ORDER BY id DESC
         LIMIT 1`,
        [numero],
        (err, ultimaProducao) => {
          if (err) {
            console.error(err)
            return res.status(500).json({ erro: "Erro ao buscar produção" })
          }

          res.json({
            corte,
            ultima_producao: ultimaProducao || null
          })
        }
      )
    }
  )
})


app.get("/cortes/:numero", (req, res) => {
  const { numero } = req.params

  db.get(
    "SELECT * FROM cortes WHERE numero = ?",
    [numero],
    (err, row) => {
      if (err) {
        console.error(err)
        return res.status(500).json({ erro: "Erro ao buscar corte" })
      }

      if (!row) {
        return res.status(404).json({ erro: "Corte não encontrado" })
      }

      res.json(row)
    }
  )
})

app.get("/cortes", (req, res) => {
  db.all("SELECT * FROM cortes", [], (err, rows) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ erro: "Erro ao buscar cortes" })
    }

    res.json(rows)
  })
})

app.post("/producao", (req, res) => {
  const {
    data,
    numero_corte,
    turno,
    operador,
    folha_inicio,
    folha_parou,
    status
  } = req.body

  db.run(
    `INSERT INTO producao 
    (data, numero_corte, turno, operador, folha_inicio, folha_parou, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data, numero_corte, turno, operador, folha_inicio, folha_parou, status],
    function (err) {
      if (err) {
        console.error(err)
        return res.status(500).json({ erro: "Erro ao cadastrar produção" })
      }

      res.json({
        mensagem: "Produção cadastrada com sucesso",
        producao: {
          id: this.lastID,
          data,
          numero_corte,
          turno,
          operador,
          folha_inicio,
          folha_parou,
          status
        }
      })
    }
  )
})

app.get("/producao/:numero/ultima", (req, res) => {
  const { numero } = req.params

  db.get(
    `SELECT * FROM producao
     WHERE numero_corte = ?
     ORDER BY id DESC
     LIMIT 1`,
    [numero],
    (err, row) => {
      if (err) {
        console.error(err)
        return res.status(500).json({ erro: "Erro ao buscar última produção" })
      }

      if (!row) {
        return res.status(404).json({
          erro: "Nenhuma produção encontrada para este corte"
        })
      }

      res.json(row)
    }
  )
})

app.get("/producao", (req, res) => {
  db.all("SELECT * FROM producao", [], (err, rows) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ erro: "Erro ao buscar produção" })
    }

    res.json(rows)
  })
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})

app.get("/producao/:numero", (req, res) => {
  const { numero } = req.params

  db.all(
    `SELECT * FROM producao
     WHERE numero_corte = ?
     ORDER BY id ASC`,
    [numero],
    (err, rows) => {
      if (err) {
        console.error(err)
        return res.status(500).json({ erro: "Erro ao buscar histórico do corte" })
      }

      res.json(rows)
    }
  )
})

app.get("/cortes-em-andamento", (req, res) => {
  db.all(
    `
    SELECT 
      c.numero,
      c.produto,
      c.mesa,
      p.folha_parou,
      p.status
    FROM cortes c
    JOIN producao p ON c.numero = p.numero_corte
    WHERE p.id IN (
      SELECT MAX(id)
      FROM producao
      GROUP BY numero_corte
    )
    AND p.status != 'FINALIZADO'
    ORDER BY c.numero ASC
    `,
    [],
    (err, rows) => {
      if (err) {
        console.error(err)
        return res.status(500).json({ erro: "Erro ao buscar cortes em andamento" })
      }

      res.json(rows)
    }
  )
})