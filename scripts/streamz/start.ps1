<#
.SYNOPSIS
  Start Streamz (database, API, Kit) en/of de venue-bridge met de versies uit streamz.local.env.

.DESCRIPTION
  Wat er start, staat in streamz.local.env (RUN_STREAMZ, RUN_BRIDGE); -Only overschrijft dat. Start Docker
  Desktop als het nog niet draait en wacht tot de API en de bridge antwoorden. Al draaiende containers met
  dezelfde versie blijven gewoon draaien.

.EXAMPLE
  .\start.ps1                    # alles wat in streamz.local.env aan staat
  .\start.ps1 -Only bridge       # alleen de venue-bridge
  .\start.ps1 -NoBrowser
#>
[CmdletBinding()]
param(
  [ValidateSet('all', 'streamz', 'bridge')]
  [string]$Only = 'all',
  [string]$ConfigFile,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

$configPath = Resolve-ConfigPath $ConfigFile
$cfg = Read-StreamzConfig $configPath
$runStreamz = ($Only -eq 'streamz') -or ($Only -eq 'all' -and (Test-Enabled $cfg 'RUN_STREAMZ'))
$runBridge = ($Only -eq 'bridge') -or ($Only -eq 'all' -and (Test-Enabled $cfg 'RUN_BRIDGE'))
if (-not $runStreamz -and -not $runBridge) {
  throw "Er staat niets aan: zet RUN_STREAMZ en/of RUN_BRIDGE op true in $configPath"
}

Confirm-Docker

if ($runStreamz) {
  if (-not (Test-Path (Join-Path $Root 'secrets.prod.env'))) {
    throw 'secrets.prod.env ontbreekt (zie secrets.prod.env.example).'
  }
  Write-Host "Streamz starten (API $($cfg['STREAMZ_API_VERSION']), Kit $($cfg['STREAMZ_KIT_VERSION']); leeg = standaard uit docker-compose-prod.yml)..."
  Invoke-Compose ((Get-StreamzArgs $configPath) + @('up', '-d'))
  Wait-Http 'http://localhost:3333/api/health' 'De API' | Out-Null
}

if ($runBridge) {
  if (-not $cfg['API_URL'] -or -not $cfg['API_KEY']) {
    throw "Zet API_URL en API_KEY in $configPath voor de venue-bridge."
  }
  New-Item -ItemType Directory -Force -Path (Join-Path $Root 'data\venue-bridge') | Out-Null
  if ($cfg['BRIDGE_VARIANT'] -eq 'windows-robocopy' -and
      -not (Get-ScheduledTask -TaskName 'Streamz statistics sync' -ErrorAction SilentlyContinue)) {
    Write-Warning 'De robocopy-taak ontbreekt: de statistieken worden niet gekopieerd. Eenmalig: scripts\venue-bridge\sync-stats.ps1 -Install'
  }
  Write-Host "Venue-bridge starten (versie $($cfg['STREAMZ_BRIDGE_VERSION']), variant $($cfg['BRIDGE_VARIANT']))..."
  Invoke-Compose ((Get-BridgeArgs $configPath $cfg) + @('up', '-d', 'venue-bridge'))
  Wait-Http 'http://localhost:3340/health' 'De venue-bridge' | Out-Null
}

Write-Host ''
if ($runStreamz) { Write-Host 'Streamz:       http://localhost' }
if ($runBridge) { Write-Host 'Venue-bridge:  http://localhost:3340 (verbonden? Beheer > Instellingen > Venue)' }
if (-not $NoBrowser) {
  if ($runStreamz) { Start-Process 'http://localhost' } else { Start-Process 'http://localhost:3340' }
}
