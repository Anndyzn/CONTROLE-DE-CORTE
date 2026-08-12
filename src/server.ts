import express from "express"
import path from "path"

import cortesRoutes from "./routes/cortes.routes"
import producaoRoutes from "./routes/producao.routes"
import itensRoutes from "./routes/itens.routes"
import consultasRoutes from "./routes/consultas.routes"

const app = express()

app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

app.use(cortesRoutes)
app.use(producaoRoutes)
app.use(itensRoutes)
app.use(consultasRoutes)

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})