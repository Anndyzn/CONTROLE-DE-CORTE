import { Router } from "express"
import { assumirTrabalho, listarTrabalhos, alterarTrabalho } from "../services/trabalho-corte"
import { numeroCorteValido } from "../utils/validacoes"
import { ErroRegra } from "../services/corte-bloqueado"
const router=Router()
for(const metodo of ["put","delete"] as const)router[metodo]("/cortes/:numero/trabalhos/:id",async(req,res)=>{
  if(!numeroCorteValido(req.params.numero)||!numeroCorteValido(req.params.id))return res.status(400).json({erro:"Corte ou início inválido."})
  try{return res.json(await alterarTrabalho(Number(req.params.numero),Number(req.params.id),req.body,metodo==="delete"))}
  catch(e){if(e instanceof ErroRegra)return res.status(e.status).json({erro:e.message});console.error("Erro ao alterar início:",e);return res.status(500).json({erro:"Não foi possível alterar o início. Os dados foram mantidos."})}
})
router.post("/cortes/:numero/trabalhos",async(req,res)=>{
  if(!numeroCorteValido(req.params.numero))return res.status(400).json({erro:"Corte inválido."})
  try{const r=await assumirTrabalho(Number(req.params.numero),req.body);return res.status(r.novo?201:200).json(r)}
  catch(e){if(e instanceof ErroRegra)return res.status(e.status).json({erro:e.message});console.error("Erro ao assumir trabalho:",e);return res.status(500).json({erro:"Não foi possível registrar o início do trabalho."})}
})
router.get("/cortes/:numero/trabalhos",async(req,res)=>{
  if(!numeroCorteValido(req.params.numero))return res.status(400).json({erro:"Corte inválido."})
  try{res.setHeader("Cache-Control","no-store");return res.json({trabalhos:await listarTrabalhos(Number(req.params.numero))})}
  catch(e){console.error("Erro ao consultar trabalho:",e);return res.status(500).json({erro:"Não foi possível consultar os trabalhos deste corte."})}
})
export default router
