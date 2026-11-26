let carregamento = null

export function carregarBibliotecaRealtime() {
  if (window.supabase) return Promise.resolve(window.supabase)
  if (!carregamento) {
    carregamento = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
      script.async = true
      script.onload = () => window.supabase ? resolve(window.supabase) : reject(new Error('Biblioteca de tempo real indisponível.'))
      script.onerror = () => { script.remove(); reject(new Error('Não foi possível carregar a conexão em tempo real.')) }
      document.head.append(script)
    }).catch(erro => { carregamento = null; throw erro })
  }
  return carregamento
}
