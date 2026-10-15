import express from "express"
import path from "path"

import cortesRoutes from "./routes/cortes.routes"
import producaoRoutes from "./routes/producao.routes"
import itensRoutes from "./routes/itens.routes"
import consultasRoutes from "./routes/consultas.routes"
import historicoAdminRoutes from "./routes/historico-admin.routes"
import { prepararHistoricoAdmin } from "./services/historico-admin"

const app = express()

app.use(express.json())

app.use(
  express.static(
    path.join(__dirname, "public")
  )
)

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  )
})

app.use(cortesRoutes)
app.use(producaoRoutes)
app.use(itensRoutes)
app.use(consultasRoutes)
app.use(historicoAdminRoutes)

const PORT =
  process.env.PORT || 3000

prepararHistoricoAdmin().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`)
  })
}).catch(erro => {
  console.error("Não foi possível preparar o histórico administrativo:", erro)
  process.exit(1)
})
