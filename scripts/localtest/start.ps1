<#
.SYNOPSIS
  Start de localtest-omgeving (docker-compose-localtest.yml) en de venue-bridge (gebouwd uit de lokale code),
  met de instellingen uit localtest.local.env. Windows-variant van scripts/localtest/start.sh.

.EXAMPLE
  .\start.ps1                  # bouwt en start Streamz en (RUN_BRIDGE=true) de bridge
  .\start.ps1 -Only bridge     # alleen de bridge (bijv. na het invullen van API_KEY)
  .\start.ps1 -NoBuild         # de al gebouwde images
  .\start.ps1 -Reset           # database terug naar de backup (down -v) en dan starten
  .\start.ps1 -Stop            # alles stoppen (de database blijft bewaard)
#>
[CmdletBinding()]
param(
  [ValidateSet('all', 'streamz', 'bridge')]
  [string]$Only = 'all',
  [string]$ConfigFile,
  [switch]$NoBuild,
  [switch]$Reset,
  [switch]$Stop
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\streamz\common.ps1')

if (-not $ConfigFile) { $ConfigFile = Join-Path $Root 'localtest.local.env' }
if (-not (Test-Path $ConfigFile)) {
  throw "$ConfigFile ontbreekt. Kopieer localtest.local.env.example naar localtest.local.env en vul hem in."
}
$configPath = (Resolve-Path $ConfigFile).Path
$cfg = Read-StreamzConfig $configPath

$base = @('--env-file', $configPath, '-f', (Join-Path $Root 'docker-compose-localtest.yml'))
$bridgeFiles = @('-f', (Join-Path $Root 'apps\venue-bridge\compose\docker-compose.venue-bridge.yml'))
$variant = $cfg['BRIDGE_VARIANT']
if ($variant) {
  $file = Join-Path $VariantDir "$variant.yml"
  if (-not (Test-Path $file)) {
    $names = (Get-ChildItem $VariantDir -Filter *.yml | ForEach-Object { $_.BaseName }) -join ', '
    throw "Onbekende BRIDGE_VARIANT '$variant' (kies uit: $names)"
  }
  $bridgeFiles += @('-f', $file)
}
$build = if ($NoBuild) { @() } else { @('--build') }

# down met de bridge-bestanden erbij (zelfde project); API_KEY mag dan leeg zijn
function Invoke-Down([string[]]$Extra) {
  $had = Test-Path Env:API_KEY
  if (-not $had) { $env:API_KEY = 'unused' }
  try { Invoke-Compose ($base + $bridgeFiles + @('down') + $Extra) } finally { if (-not $had) { Remove-Item Env:API_KEY } }
}

Confirm-Docker

if ($Stop) { Invoke-Down @(); return }

$runStreamz = $Only -ne 'bridge'
$runBridge = ($Only -eq 'bridge') -or ($Only -eq 'all' -and (Test-Enabled $cfg 'RUN_BRIDGE'))

if ($runStreamz) {
  if ($Reset) {
    Write-Host 'Database terugzetten naar de backup (down -v)...'
    Invoke-Down @('-v')
  }
  $sql = $cfg['LOCALTEST_SQL']
  if (-not $sql) { $sql = '../2025-2026-backup/streamz-2025.sql' }
  $sqlPath = if ([IO.Path]::IsPathRooted($sql)) { $sql } else { Join-Path $Root $sql }
  if (-not (Test-Path $sqlPath)) {
    Write-Warning "De backup $sql bestaat niet; een nieuwe database begint dan leeg."
  }
  Write-Host 'Streamz localtest starten...'
  Invoke-Compose ($base + @('up', '-d') + $build)
  Wait-Http 'http://localhost:3334/api/health' 'De API' | Out-Null
}

$bridgeStarted = $false
if ($runBridge) {
  if (-not $cfg['API_KEY']) {
    Write-Host ''
    Write-Host 'De bridge start nog niet: API_KEY is leeg. Maak in de Kit (http://localhost) bij Beheer > Organisatie-instellingen >'
    Write-Host "API-sleutels een sleutel, zet hem in $configPath en draai: scripts\localtest\start.cmd -Only bridge"
  } else {
    New-Item -ItemType Directory -Force -Path (Join-Path $Root 'data\venue-bridge') | Out-Null
    $label = if ($variant) { $variant } else { 'opgeslagen pagina' }
    Write-Host "Venue-bridge starten ($label)..."
    Invoke-Compose ($base + $bridgeFiles + @('up', '-d') + $build + @('venue-bridge'))
    Wait-Http 'http://localhost:3340/health' 'De venue-bridge' | Out-Null
    $bridgeStarted = $true
  }
}

Write-Host ''
if ($runStreamz) { Write-Host 'Streamz:      http://localhost   (API http://localhost:3334, pgAdmin http://localhost:5050)' }
if ($bridgeStarted) { Write-Host 'Venue-bridge: http://localhost:3340 (verbonden? Beheer > Instellingen > Venue)' }
