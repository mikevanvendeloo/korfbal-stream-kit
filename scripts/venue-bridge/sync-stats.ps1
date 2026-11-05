<#
.SYNOPSIS
  Houdt een lokale map gelijk met de share van de statistiek-pc (robocopy), voor de statistics bridge op Windows.

.DESCRIPTION
  De bridge leest een lokale map (compose/variants/windows-robocopy.yml mount C:/streamz/stats). Zo hangt
  of vertraagt een share die niet antwoordt de bridge niet: robocopy probeert het één keer (/R:0 /W:0) en
  het script wacht dan gewoon tot de volgende ronde. Alleen gewijzigde bestanden worden gekopieerd.

  Gebruik:
    .\sync-stats.ps1                                   # blijft draaien, elke 5 seconden
    .\sync-stats.ps1 -IntervalSeconds 10 -Source '\\10.12.0.63\KL2627' -Destination 'C:\streamz\stats'
    .\sync-stats.ps1 -Install                          # registreert een geplande taak die bij het inloggen start

  Met -Files beperk je de kopie tot de bestanden die de bridge nodig heeft (standaard WEDSTRIJDEN.mdb en de
  .html-pagina's). De mappen F1, F2, ... worden meegenomen.
#>
[CmdletBinding()]
param(
  [string]$Source = '\\10.12.0.63\KL2627',
  [string]$Destination = 'C:\streamz\stats',
  [int]$IntervalSeconds = 5,
  [string[]]$Files = @('WEDSTRIJDEN.mdb', '*.html', '*.htm'),
  [switch]$Install,
  [string]$TaskName = 'Streamz statistics sync'
)

$ErrorActionPreference = 'Stop'

if ($Install) {
  $script = $MyInvocation.MyCommand.Path
  $argument = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`" -Source `"$Source`" -Destination `"$Destination`" -IntervalSeconds $IntervalSeconds"
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argument
  $trigger = New-ScheduledTaskTrigger -AtLogOn
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
  Start-ScheduledTask -TaskName $TaskName
  Write-Host "Geplande taak '$TaskName' geregistreerd en gestart. Verwijderen: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
  return
}

New-Item -ItemType Directory -Force -Path $Destination | Out-Null
Write-Host "Sync $Source -> $Destination elke $IntervalSeconds s (Ctrl+C om te stoppen)"

while ($true) {
  # /E: ook submappen (F1, F2), /XO niet nodig: robocopy kopieert alleen wat nieuwer of anders is.
  # /R:0 /W:0: niet blijven proberen als de share niet antwoordt. /NJH /NJS /NDL /NP /NFL: stil.
  # Exit codes 0-7 zijn goed (0 niets, 1 gekopieerd, 2-7 extra of afwijkend); 8 en hoger is een fout.
  & robocopy $Source $Destination @Files /E /R:0 /W:0 /NJH /NJS /NDL /NP /NFL | Out-Null
  $code = $LASTEXITCODE
  if ($code -ge 8) {
    Write-Warning "$(Get-Date -Format s) robocopy kon de share niet lezen (code $code); de laatst gekopieerde bestanden blijven staan."
  }
  Start-Sleep -Seconds $IntervalSeconds
}
