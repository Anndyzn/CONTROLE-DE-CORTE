const observados=new WeakSet()
export function limparErroCampo(campo){
 if(typeof campo==='string')campo=document.getElementById(campo)
 if(!campo)return
 const id=`${campo.id}Erro`
 document.getElementById(id)?.remove()
 campo.removeAttribute('aria-invalid')
 const descricao=(campo.getAttribute('aria-describedby')??'').split(/\s+/).filter(v=>v&&v!==id).join(' ')
 if(descricao)campo.setAttribute('aria-describedby',descricao);else campo.removeAttribute('aria-describedby')
 campo.closest('.form-group')?.classList.remove('campo-invalido')
}
export function marcarErroCampo(id,mensagem,{focar=true}={}){
 const campo=document.getElementById(id)
 if(!campo)return
 limparErroCampo(campo)
 const aviso=document.createElement('small');aviso.id=`${id}Erro`;aviso.className='erro-campo';aviso.textContent=mensagem;aviso.setAttribute('role','status')
 campo.insertAdjacentElement('afterend',aviso)
 campo.setAttribute('aria-invalid','true')
 campo.setAttribute('aria-describedby',[campo.getAttribute('aria-describedby'),aviso.id].filter(Boolean).join(' '))
 campo.closest('.form-group')?.classList.add('campo-invalido')
 if(!observados.has(campo)){campo.addEventListener('input',()=>limparErroCampo(campo));campo.addEventListener('change',()=>limparErroCampo(campo));observados.add(campo)}
 if(focar)campo.focus()
}
export function validarObrigatoriosCampos(campos){
 const vazios=Object.entries(campos).filter(([id])=>!document.getElementById(id)?.value?.trim())
 for(const [i,[id,rotulo]] of vazios.entries())marcarErroCampo(id,`Informe ${rotulo}.`,{focar:i===0})
 return vazios.length===0
}
export function marcarErrosNumericos(campos){
 let primeiro=true
 for(const [id,valor] of Object.entries(campos))if(!Number.isFinite(Number(valor))||Number(valor)<0){marcarErroCampo(id,'Informe um número igual ou maior que zero.',{focar:primeiro});primeiro=false}
}
