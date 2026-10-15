const path = require('node:path')
const {ROOT,executar} = require('./backup-lib.cjs')
const tarefa = 'Dimepor - Backup Controle de Corte'
const aspas = valor => "'"+valor.replaceAll("'","''")+"'"

async function main() {
  if (process.platform !== 'win32') throw new Error('O agendamento local deste comando é destinado ao Windows.')
  const indice = process.argv.indexOf('--hora')
  const hora = indice < 0 ? '08:00' : process.argv[indice+1]
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora || '')) throw new Error('Informe --hora HH:mm, por exemplo --hora 08:00.')
  const comandoNode = `& ${aspas(process.execPath)} ${aspas(path.join(ROOT,'scripts','backup.cjs'))} daily; exit $LASTEXITCODE`
  const argumentos = '-NoProfile -NonInteractive -WindowStyle Hidden -Command "'+comandoNode+'"'
  const script = `
    $ErrorActionPreference = 'Stop'
    if ((Get-TimeZone).Id -ne 'E. South America Standard Time') { throw 'O Windows precisa estar no horário de Brasília antes de instalar este agendamento.' }
    $nomeTarefa = ${aspas(tarefa)}
    if (Get-ScheduledTask -TaskName $nomeTarefa -ErrorAction SilentlyContinue) { throw 'A tarefa já existe. Revise-a no Agendador de Tarefas antes de substituir sua configuração.' }
    $acao = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ${aspas(argumentos)} -WorkingDirectory ${aspas(ROOT)}
    $gatilho = New-ScheduledTaskTrigger -Daily -At ${aspas(hora)}
    $ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 15)
    $usuario = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $principal = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $nomeTarefa -Action $acao -Trigger $gatilho -Settings $ajustes -Principal $principal -Description 'Backup diário do schema public e teste de recuperação em PostgreSQL isolado. Depende do Docker Desktop e do usuário conectado.' | Out-Null
    Get-ScheduledTask -TaskName $nomeTarefa | ForEach-Object { [pscustomobject]@{Tarefa=$_.TaskName; Estado=[string]$_.State; Horario=${aspas(hora)}; Fuso='Brasilia'} } | ConvertTo-Json -Compress
  `
  console.log(await executar('powershell.exe',['-NoProfile','-NonInteractive','-Command',script]))
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
