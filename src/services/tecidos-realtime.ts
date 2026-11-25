import { Request, Response } from "express"

// Envia somente um aviso de alteração. A leitura dos dados continua pela API.
const conexoes = new Set<Response>()
function enviar(res: Response, evento: string) {
  if (res.destroyed || res.writableEnded) { conexoes.delete(res); return }
  try {
    if (!res.write(`event: ${evento}\ndata: {}\n\n`)) res.end()
  } catch { res.destroy(); conexoes.delete(res) }
}

export function conectarTecidosRealtime(_req: Request, res: Response) {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8")
  res.setHeader("Cache-Control", "no-cache, no-store, no-transform")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("X-Accel-Buffering", "no")
  res.flushHeaders()
  res.write("retry: 3000\n\n")
  conexoes.add(res)
  const pulso = setInterval(() => enviar(res, "pulso"), 20000)
  pulso.unref()
  res.on("close", () => { clearInterval(pulso); conexoes.delete(res) })
  enviar(res, "conectado")
}

export function notificarTecidosAlterados() {
  for (const res of conexoes) enviar(res, "alteracao")
}
